var fs = require('fs');
var path = require('path');
var PluginError = require('gulp-util').PluginError;
var PLUGIN_NAME = require("./pluginName");

function processLocales(hasTranslations, baseLocalePath, localeFileName, assemblyName, assemblyPath, options) {
  "use strict";

  var key, keys = [], len, keyStr, contents = "";
  var translations, strings, localeList = [];
  var supportTransKeys = !!options.supportTransKeys;

  options.localeVar = options.localeVar || "window.locale";

  if (supportTransKeys) {
    localeList =["zz","ke"];
  }

  if (hasTranslations) {
    translations = readLocaleFiles(baseLocalePath, localeFileName, options.locale);
  }

  if (process.env.TAAS_EX) {
    var taasPath = assemblyPath
                    .replace( path.join(process.cwd(), '/'), '')
                    .replace(/^assets\//, '')
                    .replace(/\//g, '.');

    if (translations && translations.key) {
      contents += "// TEMPORARY HACK\n" +
                  "// fake having all the translations files uploaded to TAAS\n";
      contents += "FS.taasContent = FS.taasContent || {};\n";

      translations.langs.sort().forEach(function(locale, index) {
        contents += "\nFS.taasContent." + locale + " = FS.taasContent." + locale + " || {};\n";

        taasPath.split('.').forEach(function(part, index) {
          var currPath = "['" + taasPath.split('.').slice(0, index + 1).join("']['") + "']";

          contents += "FS.taasContent." + locale + currPath + " = " + "FS.taasContent." + locale + currPath + " || {};\n";
        });

        var currPath = "['" + taasPath.split('.').join("']['") + "']";

        translations.key.forEach(function(key, keyIndex) {
          contents += "FS.taasContent." + locale + currPath + "['" + key + "'] = " +
                    JSON.stringify(translations[locale][key] || translations[options.locale][key] || "") + ";\n";
        });
      });
    }

    contents += "\nvar lang = FS.i18n ? FS.i18n('" + taasPath + "') : {};\n\n" +

                "function format(str) {\n" +
                "  // Template bindings (Angular, Polymer, etc.) need to be excluded, which requires two\n" +
                "  // regexs. The first will grab all binding and translation like strings, the second will\n" +
                "  // exclude any strings that stat with more than one open bracket\n" +
                "  var potentialSubstitutionsRegex = /\{+?[^{\\n\\r]+\}/g;\n" +
                "  var trueSubstitutionsRegex = /^\{([^{}]+)\}/;\n" +
                "  var isTaasKey = /^fs\./;\n\n" +

                "  if (typeof lang !== 'object') {\n" +
                "    lang = Array.prototype.slice.call(arguments, 1);\n" +
                "  }\n\n" +

                "  return str.replace(potentialSubstitutionsRegex, function (fullKey) {\n" +
                "    // ensure it's a translation binding and not a template binding\n" +
                "    if (trueSubstitutionsRegex.test(fullKey)) {\n" +
                "      return fullKey.replace(trueSubstitutionsRegex, function(match, key) {\n\n" +

                "        // use TAAS for non-legacy keys\n" +
                "        if (isTaasKey.test(key)) {\n" +
                "          return FS.i18n(key);\n" +
                "        }\n" +
                "        else {\n" +
                "          return lang[key] === undefined ? match : lang[key];\n" +
                "        }\n" +
                "      });\n" +
                "    }\n" +
                "    else {\n" +
                "      return fullKey;\n" +
                "    }\n" +
                "  });\n" +
                "}";

    return contents;
  }

  if (translations && translations.key) {
    contents += "var langKeys = "+JSON.stringify(translations.key)+";\n";
    // Output the langs table.
    contents += "var langs = {\n";
    translations.langs.sort().forEach(function(locale, index) {
      localeList.push(locale);
      contents +=  "  // Included locale file: " + localeFileName + "_" + locale + ".json\n";
      strings = [];

      translations.key.forEach(function(key, keyIndex) {
        if (options.tagMissingStrings) {
          strings.push(translations[locale][key] || "-*"+(translations[options.locale][key] || "Not Found")+"*-");
        }
        else {
          strings.push(translations[locale][key] || translations[options.locale][key] || "");
        }
      });
      contents += '  "'+locale+'": ' + JSON.stringify(strings);
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
      contents += "function getLang(locales) {\n"+
                  "  var locale, language, i, len = langKeys.length, lang = {};\n"+
                  "  locales = (typeof locales === 'string' ? [locales] : locales);\n"+
                  "  for (i = 0; i < locales.length; i++) {\n"+
                  "    language = locales[i];\n"+
                  "    if (validLocales.indexOf(language) !== -1) {\n"+
                  "      locale = language;\n"+
                  "      break;\n"+
                  "    } else {\n"+
                  "      //Check if the first two characters are a valid locale\n"+
                  "      language = locales[i].split('-')[0];\n"+
                  "      if (validLocales.indexOf(language) !== -1) {\n"+
                  "        locale = language;\n"+
                  "        break;\n"+
                  "      }\n"+
                  "    }\n"+
                  "  }\n"+
                  "  locale = locale || '" + options.locale + "';\n";

      if (supportTransKeys) {
        // Support the special locales of ke[key] and zz[assembly.key]
        contents += "  var temp;\n"+
                    "  switch (locale) {\n"+
                    "    case 'ke':\n"+
                    "    case 'zz':\n"+
                    "      for(i = 0; i < len; i++) {\n"+
                    "        temp = (locale === 'ke' ? '[' + langKeys[i] + ']' : '["+assemblyName+".' + langKeys[i] + ']');\n"+
                    "        lang[langKeys[i]] = temp;\n"+
                    "      }\n"+
                    "      break;\n\n"+
                    "    default:\n"+
                    "      for(i = 0; i < len; i++) {\n"+
                    "        lang[langKeys[i]] = langs[locale][i];\n"+
                    "      }\n"+
                    "      break;\n"+
                    "  }\n";
      }
      else {
        // Don't support the two special locales.
        contents += "  for(i = 0; i < len; i++) {\n"+
                    "    lang[langKeys[i]] = langs[locale][i];\n"+
                    "  }\n";
      }

      // Return the correct lang object
      contents += "  return lang;\n"+
                  "}";
    }
    else {
      contents += "function getLang(locale) {\n"+
                  "  // Emulate the internal getLang function by calling the external function\n"+
                  "  return __gca_getLang(locale, langKeys, validLocales, langs, '"+assemblyName+"', '"+(options.defaultLocale||"en")+"');\n"+
                  "}";
    }
    // set the lang variable
    contents += "\n\nvar lang = getLang("+options.localeVar+" || '"+options.locale+"');";

    if (options.exposeLang) {
      var globalObj = "window."+(options.globalObj || "components");
      var globalAssembly = globalObj+"."+assemblyName;
      contents += "\n\n";
      contents += globalObj      + " = " + globalObj      + " || {};\n";
      contents += globalAssembly + " = " + globalAssembly + " || {};\n";
      contents += globalAssembly + ".lang = lang;";
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
