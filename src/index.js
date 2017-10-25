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
  "use strict";
  var assemblyStream = new stream.Transform({objectMode: true});
  var firstTime = true;
  options = options || {};
  options.locale = options.defaultLocale || "en";

  assemblyStream._transform = function(file, unused, callback) {
    var assembly, temp;
    try {
      assembly = JSON.parse(file.contents);
    }
    catch(ex) {
      callback(new PluginError(PLUGIN_NAME, "Unable to parse .json file: " + file.path));
    }

    // Determine the locales and call this for each locale if the split flag is set
    var projectPath = path.dirname(file.path);
    var localePath = path.join(projectPath, (assembly.localePath || "locales"));
    var localeFileName = assembly.localeFileName || "strings";
    var localeArray = findLocales(localePath, localeFileName, options.locale);

    if(localeArray && assembly.splitByLocales === true) {
      // Create multiple files - 1 for each locale
      localeArray.forEach( (locale) => {
        createAssembly(firstTime, this, assembly, file.path, locale, options);
        firstTime = false;
      });
    } else {
      // Don't split into multiple files
     createAssembly(firstTime, this, assembly, file.path, null, options);
     firstTime = false;
    }
  };

  return assemblyStream;
}

function createAssembly(firstTime, stream, assembly, filePath, processLocale, options) {
  var contents;
  try {
    contents = new Buffer(assemblies.process(assembly, filePath, processLocale, options));
  } catch (err) {
    callback(new PluginError(PLUGIN_NAME, err));
  }

  temp = path.dirname(filePath);
  if (options.useOldDest) {
    filePath = path.join(temp, path.basename(temp)+'.js');
  }
  else {
    if(processLocale) {
      filePath = path.join(path.dirname(temp), path.basename(temp)+'_'+processLocale+'.js');
    } else {
      filePath = path.join(path.dirname(temp), path.basename(temp)+'.js');
    }
  }

  var localeSpecificFile = new gutil.File({
    "path": filePath,
    "contents": contents
  });

  stream.push(localeSpecificFile);

  if (firstTime && options.useExternalLib) {
    var file2 = new gutil.File({
      "path": path.join(options.externalLibPath || "./", options.externalLibName || "assembly-lib.js"),
      "contents": new Buffer(externalFuncs.template(options))
    });
    stream.push(file2);
  }
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
    // This just means that no locales were found
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
