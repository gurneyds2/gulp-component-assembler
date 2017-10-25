var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var stream = require("stream");
var assemblies = require("./assemblies");
var externalFuncs = require("./externalFunctions");
var PluginError = require('gulp-util').PluginError;
var plugin = require("./plugin");
var PLUGIN_NAME = require("./pluginName");

function assemble(options) {
  console.log("==========================STARTING ASSEMBLE===============================================");
  console.log('options:' + JSON.stringify(options));

  "use strict";
  var assemblyStream = new stream.Transform({objectMode: true});
  var firstTime = true;
  options = options || {};
  options.locale = options.defaultLocale || "en";

  assemblyStream._transform = function(file, unused, callback) {
    var assembly, temp;
    try {
      assembly = JSON.parse(file.contents);
      console.log();
      console.log("ASSEMBLY path=" + file.path + " contents:" + JSON.stringify(assembly));
      console.log();
    }
    catch(ex) {
      callback(new PluginError(PLUGIN_NAME, "Unable to parse .json file: " + file.path));
    }

    // TODO - determine the locales and call this for each locale if the split flag is set
    var projectPath = path.dirname(file.path);
    var localePath = path.join(projectPath, (assembly.localePath || "locales"));
    var localeFileName = assembly.localeFileName || "strings";
    console.log("projectPath:" + projectPath + " localePath:" + localePath + " localeFileName;" + localeFileName);
    var localeArray = findLocales(localePath, localeFileName, options.locale);
    console.log("Found locales:" + localeArray);

    if(localeArray && assembly.splitByLocales === true) {
      localeArray.forEach( (locale) => {
        var contents;
        try {
          contents = new Buffer(assemblies.process(assembly, file.path, locale, options));
        } catch (err) {
          callback(new PluginError(PLUGIN_NAME, err));
        }

        var localeSpecificFile = new gutil.File({
          "path": "transfile_" + locale + ".js",
          "contents": contents
        });
        this.push(localeSpecificFile);
      });
    } else {
      // Don't split into multiple files
    }

    try {
      file.contents = new Buffer(assemblies.process(assembly, file.path, null, options));
    } catch (err) {
      callback(new PluginError(PLUGIN_NAME, err));
    }

    temp = path.dirname(file.path);
    if (options.useOldDest) {
      file.path = path.join(temp, path.basename(temp)+'.js');
    }
    else {
      file.path = path.join(path.dirname(temp), path.basename(temp)+'.js');
    }
    this.push(file);

    if (firstTime && options.useExternalLib) {
      firstTime = false;
      var file2 = new gutil.File({
        "path": path.join(options.externalLibPath || "./", options.externalLibName || "assembly-lib.js"),
        "contents": new Buffer(externalFuncs.template(options))
      });
      this.push(file2);
    }
    callback();
  };

  return assemblyStream;
}

function findLocales(baseLocalePath, baseName, defaultLocale) {
  try {
    var files = fs.readdirSync(baseLocalePath),
        re = baseName + "_(.*).json",
        langArray = [];

    if(!files || files.length === 0) {
      return null;
    }

    files = files.forEach(function(file) {
      var lang, toks = file.match(re);

      if(toks) {
        lang = toks[1];
        fileContents = fs.readFileSync(path.join(baseLocalePath, file), {"encoding": "utf-8"});

        try {
          langArray.push(lang);
        } catch(e) {
          throw new PluginError(PLUGIN_NAME, "Unable to parse locale file: " + path.join(baseLocalePath, file) + ":: " + e);
        }
      }
    });

    return langArray;
  } catch(e) {
    return null;
  }
}

// exporting the plugin main function
module.exports = {
  "assemble": assemble,
  "loadPlugin": plugin.load,
  "pluginTypes": plugin.types,
  "watch": require("./watcher").watch,
  "hasChanged": require("./hasChanged")
};
