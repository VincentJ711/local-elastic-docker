import { exec } from 'child_process';

export class Utils {
  static exec(cmd: string, verbose?: boolean) {
    return new Promise((resolve, reject) => {
      const proc = exec(cmd, { maxBuffer: 1024 * 100000 }, (err, stdout) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout);
        }
      });

      if (verbose) {
        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
      }
    });
  }

  static is_array(v) {
    return Array.isArray(v);
  }

  static is_bool(v) {
    return typeof v === 'boolean';
  }

  static is_defined(v) {
    return typeof v !== 'undefined';
  }

  static is_function(v) {
    return typeof v === 'function';
  }

  static is_integer(v) {
    return (typeof v === 'number') && (v % 1 === 0);
  }

  static is_null(v) {
    return v === null;
  }

  static is_number(v) {
    return typeof(v) === 'number' && isFinite(v);
  }

  static is_object(v) {
    return v !== null && v instanceof Object;
  }

  static is_string(v) {
    return typeof v === 'string';
  }

  static is_undefined(v) {
    return typeof v === 'undefined';
  }
}
