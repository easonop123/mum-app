// Content versioning. Bump CONTENT_VERSION whenever user-facing safety copy,
// exercise wording, or the video manifest changes.
import programJson from './program.json';
import manifestJson from './video-manifest.json';

export const APP_VERSION = '1.0.0';
export const CONTENT_VERSION = `${programJson.programId}@${programJson.version}+copy-2026-11-03.1+media-${manifestJson.manifestVersion}`;
export const CONTENT_REVIEW_DATE = '2026-11-03';
