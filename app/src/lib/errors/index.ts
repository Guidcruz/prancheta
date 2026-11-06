/*
 * The local error log without personal data (US-045; docs/02-architecture.md, 3). The career
 * layer and the error boundaries of the screens record here; nothing is ever sent anywhere.
 */
export {
  ERROR_LOG_SIZE,
  ErrorLog,
  STACK_FRAMES,
  cleanDetail,
  cleanPath,
  cleanStack,
  cleanToken,
  errorType,
  type ErrorEntry,
  type ErrorKind,
  type ErrorLogVersions,
  type ErrorReport,
  type ErrorSink,
} from './log.ts';
