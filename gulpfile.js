var gulp       = require('gulp');
var istanbul   = require('gulp-istanbul');
var mocha      = require('gulp-mocha');
var plumber    = require('gulp-plumber');
var jshint     = require('gulp-jshint');
var collapser  = require('bundle-collapser/plugin');
var browserify = require('browserify');
var uglify     = require('gulp-uglify');
var source     = require('vinyl-source-stream');
var buffer     = require('vinyl-buffer');
var jscs       = require('gulp-jscs');
var coveralls  = require('gulp-coveralls');
var rename     = require('gulp-rename');
var options    = require('yargs').argv;
var fs         = require('fs');
var co         = require('co');
var exec       = require('child_process').exec;
var path       = require('path');

var pkg = require('./package');

var packagesDir = __dirname + '/packages';

var packages = fs.readdirSync(packagesDir).map(function(dirname) {
  try {
    return require(__dirname + '/packages/' + dirname + '/package.json');
  } catch (e) { return void 0 }
}).filter(function(pkg) { return !!pkg; });

/**
 */

var paths = {
  testFiles   : ['test/**/*-test.js', 'packages/*/*-test.js'],
  appFiles    : ['bus/**/*.js', 'stream/**/*.js'],
  allJSFiles  : ['*.js', 'test/*.js'],
  allFiles    : ['*.js', 'test/**', 'internal/**', 'bus/**', 'response/**', 'extra/**', 'examples/**', 'stream/**', 'docs/**', 'packages/**']
};

/**
 */

var mochaOptions = {
  bail     : options.bail     !== 'false',
  reporter : options.reporter || 'dot',
  grep     : options.grep     || options.only,
  timeout  : 500
};

/**
 */

gulp.task('test-coverage', function(complete) {
  gulp.
  src(paths.appFiles).
  pipe(istanbul()).
  pipe(istanbul.hookRequire()).
  on('finish', function() {
    gulp.
    src(paths.testFiles).
    pipe(plumber()).
    pipe(mocha(mochaOptions)).
    pipe(istanbul.writeReports({
      reporters: ['text', 'text-summary', 'lcov']
    })).
    on('end', complete);
  });
});

/**
 */

gulp.task('test-coveralls', ['test-coverage'], function() {
  return gulp.
  src('coverage/**/lcov.info').
  pipe(coveralls());
});

/**
 */

gulp.task('bundle', function() {
  return browserify('./index.js').
  plugin(collapser).
  transform('babelify').
  bundle().
  pipe(source(pkg.name + '.js')).
  pipe(buffer()).
  pipe(gulp.dest('./dist'));
});

/**
 */

gulp.task('minify', ['bundle'], function() {
  return gulp.
  src('./dist/' + pkg.name + '.js').
  pipe(uglify()).
  pipe(rename(function(path) {
    path.basename += '.min';
  })).
  pipe(gulp.dest('./dist'));
});

/**
 */

gulp.task('lint', function() {
  return gulp.run(['jshint', 'jscs']);
});

/**
 */

gulp.task('jscs', function() {
  return gulp.
  src(paths.allJSFiles).
  pipe(jscs({
    'preset': 'google',
    'requireParenthesesAroundIIFE': true,
    'maximumLineLength': 200,
    'esnext': true,
    'validateLineBreaks': 'LF',
    'validateIndentation': 2,
    'validateQuoteMarks': '\'',

    'disallowKeywords': ['with'],
    'disallowSpacesInsideObjectBrackets': null,
    'disallowImplicitTypeConversion': ['string'],
    'requireCurlyBraces': [],

    'safeContextKeyword': 'self'
  }));
});

/**
 */

gulp.task('jshint', function() {
  return gulp.
  src(paths.allJSFiles).
  pipe(jshint({
    esnext: true,
    evil: true
  })).
  pipe(jshint.reporter('default'));
});

/**
 */

gulp.task('test', function(complete) {
  gulp.
  src(paths.testFiles, { read: false }).
  pipe(plumber()).
  pipe(mocha(mochaOptions)).
  on('error', complete).
  on('end', complete);
});

var iofwatch = process.argv.indexOf('watch');

/**
 * runs previous tasks (1 or more)
 */

gulp.task('watch', function() {
  gulp.watch(paths.allFiles, process.argv.slice(2, iofwatch));
});

/**
 */

gulp.task('default', function() {
  return gulp.run('test-coverage');
});

/**
 */

gulp.task('examples', function(next) {
  require('./examples/_app');
});

/**
 */

gulp.task('bump-packages', function(next) {
  co(function*() {
    for (var i = packages.length; i--;) {

      var pkg      = packages[i];
      var pathname = path.join(packagesDir, pkg.name);

      console.log('bump %s', pathname);

      yield {
        then: function(resolve, reject) {
          exec('/usr/local/bin/npm version patch', { cwd: pathname }, function(err, stdout) {
            if (err) return reject(err);
            process.stdout.write(stdout);
            resolve();
          });
        }
      }
    }
  }).then(next, next);
});

/**
 */

gulp.task('publish-packages', ['bump-packages'], function(next) {
  co(function*() {
    for (var i = packages.length; i--;) {

      var pkg      = packages[i];
      var pathname = path.join(packagesDir, pkg.name);

      console.log('publish %s', pathname);

      yield {
        then: function(resolve, reject) {
          exec('/usr/local/bin/npm publish', { cwd: pathname }, function(err, stdout) {
            if (err) return reject(err);
            process.stdout.write(stdout);
            resolve();
          });
        }
      }
    }
  }).then(next, next);
});

/**
 */

gulp.doneCallback = function(err) {

  // a bit hacky, but fixes issue with testing where process
  // doesn't exist process. Also fixes case where timeout / interval are set (CC)
  if (!~iofwatch) process.exit(err ? 1 : 0);
};
