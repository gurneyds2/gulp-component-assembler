var fs = require('fs');
var path = require('path');
var PluginError = require('gulp-util').PluginError;
var PLUGIN_NAME = require("./pluginName");

function processLocales(baseLocalePath, localeFileName, assemblyName, options) {
  "use strict";

  var key, keys = [], len, keyStr, contents = "";
  var translations, strings, localeList = [];
  var supportTransKeys = !!options.supportTransKeys;

  if (supportTransKeys) {
    localeList =["zz","ke"];
  }

  translations = readLocaleFiles(baseLocalePath, localeFileName, options.locale);
  if (translations && translations.key) {
    contents += "var langKeys = "+JSON.stringify(translations.key)+";\n";
    // Output the langs table.
    contents += "var langs = {\n";
    translations.langs.sort().forEach(function(locale, index) {
      localeList.push(locale);
      contents +=  " // Included locale file: " + localeFileName + "_" + locale + ".json\n";
      strings = [];

      translations.key.forEach(function(key, keyIndex) {
        if (options.tagMissingStrings) {
          strings.push(translations[locale][key] || "-*"+(translations[options.locale][key] || "Not Found")+" *-");
        }
        else {
          strings.push(translations[locale][key] || translations[options.locale][key] || "");
        }
      });
      contents += ' "'+locale+'": ' + JSON.stringify(strings);
      if (index >= len) {
        contents += "\n";
      } else {
        contents += ",\n";
      }
    });
    contents += "};\n";
    // Output the validLocales and the routine to get the desired lang object.
    contents += "var validLocales = "+JSON.stringify(localeList.sort())+";\n\n";
    if(!options.useExternalLib) {
      contents += "function getLang(locale) {\n"+
                  " var temp, i, len = langKeys.length, lang = {};\n"+
                  " locale = (typeof(locale) === 'string' ? locale : locale[0]).split('-')[0];\n"+
                  " if (validLocales.indexOf(locale)<0) {\n"+
                  "  locale = '"+options.locale+"';\n"+
                  " }\n";
      if (supportTransKeys) {
        // We support the special locales of ke[key] and zz[assembly.key]
        contents += " switch (locale) {\n"+
                    "  case 'ke':\n"+
                    "  case 'zz':\n"+
                    "   for(i = 0; i < len; i++) {\n"+
                    "    temp = (locale==='ke'?'['+langKeys[i]+']':'["+assemblyName+".'+langKeys[i]+']');\n"+
                    "    lang[langKeys[i]] = temp;\n"+
                    "   }\n"+
                    "   break;\n"+
                    "  default:\n"+
                    "   for(i = 0; i < len; i++) {\n"+
                    "    lang[langKeys[i]] = langs[locale][i];\n"+
                    "   }\n"+
                    "   break;\n"+
                    " }\n";
      }
      else {
        // We don't support the two special locales.
        contents += " for(i = 0; i < len; i++) {\n"+
                    "  lang[langKeys[i]] = langs[locale][i];\n"+
                    " }\n";
      }

      // Return the correct lang object
      contents += " return lang;\n"+
                  "}\n\n"+
      // set the lang variable
                  "var lang = getLang(window.locale || '"+options.locale+"');\n";
    }
    else {
      contents += "function getLang(locale) {\n"+
                  " return __getLangObj(locale, langKeys, validLocales, langs);\n"+
                  "}\n\n"+
                  "var lang = getLang(window.locale || '"+options.locale+"');\n";
    }

    if (options.exposeLang) {
      contents += "window.sommus = window.sommus || {};\n";
      contents += "window.sommus."+assemblyName+" = window.sommus."+assemblyName+" || {};\n";
      contents += "window.sommus."+assemblyName+".lang = lang;\n";
    }
  }

  return contents;
}

function readLocaleFiles(baseLocalePath, baseName, defaultLocale) {
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

  return langs;
}

module.exports = {
  "process": processLocales
};
