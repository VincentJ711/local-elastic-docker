const argv = require('yargs').argv;
const cache = require('gulp-cached');
const gulp = require('gulp');
const gulp_watch = require('gulp-watch');
const ts = require('gulp-typescript');

const ts_project = ts.createProject('tsconfig.json', {
  isolatedModules: !argv.c
});

gulp.task('default', [ 'watch' ]);

gulp.task('watch', async () => {
  await new Promise(() => {
    gulp_watch([ 'src/**/*.*' ], () => gulp.start('flatten'));
    gulp.start('flatten');
  });
});

gulp.task('flatten', async () => {
  await handle_ts_files();
  await handle_other_files();
});

const handle_ts_files = async () => {
  await new Promise(res => {
    ts_project.src()
        .pipe(cache())
        .pipe(ts_project())
        .pipe(gulp.dest('dist'))
        .on('finish', res);
  });
};

const handle_other_files = async () => {
  await new Promise(res => {
    gulp.src([
      `src/**/*.*`,
      `!src/**/*.ts`
    ]).pipe(cache())
      .pipe(gulp.dest(`dist/src`))
      .on('finish', res);
  });
};
