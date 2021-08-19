const { src, dest, parallel, series, watch } = require("gulp");

// css
const sass = require("gulp-sass")(require("sass")); // compiles sass into css
const autoprefixer = require("gulp-autoprefixer"); // adds prefixes to increase browser compatibility
const gcmq = require("gulp-group-css-media-queries"); // combines repeated media queries
const cleanCSS = require("gulp-clean-css"); // minifies css

// js
const uglify = require("gulp-uglify"); // minifies js

// img
const imagemin = require("gulp-imagemin"); // minifies different types of images
const webp = require("gulp-webp"); // converts .jpg, .png, etc. into .webp

// icons
const svgSprite = require("gulp-svg-sprite"); // creates svg sprite
const svgmin = require("gulp-svgmin");
const cheerio = require("gulp-cheerio");
const replace = require("gulp-replace");

// fonts
const ttf2woff = require("gulp-ttf2woff"); // converts ttf to woff
const ttf2woff2 = require("gulp-ttf2woff2"); // converts ttf to woff2
const fonter = require("gulp-fonter"); // converts otf to ttf

// common
const fileinclude = require("gulp-file-include"); // allows import statement in html
const rename = require("gulp-rename"); // renames file name
const del = require("del"); // cleans directory
const fs = require("fs"); // works with files

// dev tools
const notify = require("gulp-notify"); // notifies when an error occured
const sourcemaps = require('gulp-sourcemaps'); // Shows sources

const bs = require("browser-sync").create(); // creates a server

// HTML

function html() {
  return src(["src/*.html", "src/pages/**/*.html"])
    .pipe(
      fileinclude({
        prefix: "@",
      })
    )
    .pipe(dest("build/"))
    .pipe(bs.stream());
}

// CSS

function prodCSS() {
  return src("src/scss/styles.scss")
    .pipe(
      sass({
        outputStyle: "expanded",
      }).on("error", notify.onError())
    )
    .pipe(gcmq())
    .pipe(
      autoprefixer({
        overrideBrowserslist: ["last 5 versions"],
      })
    )
    .pipe(dest("build/css/"))
    .pipe(
      cleanCSS({
        level: 2,
      })
    )
    .pipe(
      rename({
        suffix: ".min",
      })
    )
    .pipe(dest("build/css/"))
}

function devCSS() {
  return src("src/scss/styles.scss")
  .pipe(sourcemaps.init())
    .pipe(
      sass({
        outputStyle: "expanded",
      }).on("error", notify.onError())
    )
    .pipe(sourcemaps.write())
    .pipe(dest("build/css/"))
    .pipe(bs.stream());
}

// JavaScript
function prodJS() {
  return src("src/js/**/*.js")
    .pipe(dest("build/js"))
    .pipe(uglify())
    .on("error", notify.onError())
    .pipe(
      rename({
        suffix: ".min",
      })
    )
    .pipe(dest("build/js"))
}

function devJS() {
  return src("src/js/**/*.js")
    .pipe(dest("build/js"))
    .pipe(bs.stream());
}

function img() {
  return src(["src/img/**/*.+(jpg|jpeg|png|gif|svg|ico|webp)"])
    .pipe(
      imagemin({
        interlaced: true,
        progressive: true,
        verbose: true,
        optimizationLevel: 5,
      })
    )
    .pipe(dest("build/img/"))
    .pipe(webp())
    .pipe(dest("build/img/"));
}

function convertFonts() {
  src("src/fonts/**/*.ttf").pipe(ttf2woff()).pipe(dest("build/fonts/"));
  return src("./src/fonts/**/*.ttf")
    .pipe(ttf2woff2())
    .pipe(dest("build/fonts/"));
}

function fontStyles(done) {
  const filePath = "./src/scss/.gulpfiles/_font-families.scss";
  fs.writeFileSync(filePath, "");
  fs.readdir("build/fonts/", (err, files) => {
    if (files) {
      let checkedFiles = [];
      let data;
      files.forEach(file => {
        const [fileName, fileExtension] = file.split(".");
        if (
          (fileExtension === "woff" || fileExtension === "woff2") &&
          !checkedFiles.includes(fileName)
        ) {
          data = `@include font(${fileName}, ${fileName});\n`;
          fs.appendFileSync(filePath, data);
          checkedFiles.push(fileName);
        }
      });
    }
  });
  done();
}

const fonts = series(convertFonts, fontStyles);

function otf2ttf() {
  return src("src/fonts/**/*.otf")
    .pipe(
      fonter({
        formats: ["ttf"],
      })
    )
    .pipe(dest("src/fonts/"));
}

function cleanIconFolder() {
  return del("src/icons/pre-built/*");
}

function monochromeIcons() {
  return src("src/icons/monochrome/**/*.svg")
    .pipe(
      svgmin({
        js2svg: {
          pretty: true,
        },
      })
    )
    .pipe(
      cheerio({
        run: function ($) {
          $("[fill]").removeAttr("fill");
          $("[stroke]").removeAttr("stroke");
          $("[style]").removeAttr("style");
        },
        parserOptions: { xmlMode: true },
      })
    )
    .pipe(replace("&gt;", ">"))
    .pipe(dest("src/icons/pre-built"));
}

function colorfulIcons() {
  return src("src/icons/colorful/**/*.svg")
    .pipe(
      svgmin({
        js2svg: {
          pretty: true,
        },
      })
    )
    .pipe(dest("src/icons/pre-built"));
}

function spriteIcons() {
  return src("src/icons/pre-built/*.svg")
    .pipe(
      svgSprite({
        mode: {
          symbol: {
            sprite: "../sprite.svg",
            prefix: ".i-",
            dimensions: "%s",
            render: {
              scss: {
                dest: "../../../src/scss/.gulpfiles/_sprite.scss",
              },
            },
          },
        },
      })
    )
    .pipe(dest("build/img"));
}

const icons = series(
  cleanIconFolder,
  parallel(monochromeIcons, colorfulIcons),
  spriteIcons
);

function resources() {
  return src("src/resources/**/*").pipe(dest("build/resources"));
}

function watchChanges() {
  bs.init({
    server: {
      baseDir: "./build/",
    },
    port: 3000,
    notify: false,
    ghostMode: false,
  });
  watch(["src/*.html", "src/components/**/*.html"], html);
  watch("src/scss/**/*.scss", devCSS);
  watch("src/js/**/*.js", devJS);
  watch("src/img/**/*.+(jpg|jpeg|png|svg|gif|ico|webp)", img);
  watch("src/resources/*", resources);
  watch(["src/icons/colorful/*.svg", "src/icons/monochrome/*.svg"], icons);
  watch("src/fonts/**/*.ttf", fonts);
}

function clean() {
  return del("build/*");
}

exports.ttf = otf2ttf;

exports.build = series(
  clean,
  parallel(html, prodCSS, prodJS, icons, img, resources, fonts)
);

exports.default = exports.watch = series(
  clean,
  parallel(html, devCSS, devJS, icons, img, resources, fonts),
  watchChanges
);
