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

    try {
      file.contents = new Buffer(assemblies.process(assembly, file.path, options));
//      console.log("Processed file contents=" + file.contents);
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
  // TODO - how can we read just a single file? Maybe build the path of the file and read it rather than reading a directory
  var files = fs.readdirSync(baseLocalePath),
      re = baseName + "_(.*).json",
      langs = {"langs":[]};

  if(!files || files.length === 0) {
    return null;
  }

  files = files.forEach(function(file) {
    var fileContents, lang, data, key, toks = file.match(re);

    if(toks) {
      lang = toks[1];
      fileContents = fs.readFileSync(path.join(baseLocalePath, file), {"encoding": "utf-8"});

      try {
        data = JSON.parse(fileContents);
        langs[lang] = data;
        langs.langs.push(lang);
      } catch(e) {
        throw new PluginError(PLUGIN_NAME, "Unable to parse locale file: " + path.join(baseLocalePath, file) + ":: " + e);
      }

      if (lang === defaultLocale) {
        langs.key = [];
        for (key in data) {
          langs.key.push(key);
        }
      }
    }
  });

  // langs.langs returns an array of the strings
  console.log("found langs:" + JSON.stringify(langs.langs));
  console.log("found langs:" + JSON.stringify(langs));
  return langs.langs;
}

// exporting the plugin main function
module.exports = {
  "assemble": assemble,
  "loadPlugin": plugin.load,
  "pluginTypes": plugin.types,
  "watch": require("./watcher").watch,
  "hasChanged": require("./hasChanged")
};
