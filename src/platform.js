// The ONE place that decides what differs between Edge and Chrome.
//
//   Both browsers: Kokoro voices (in the browser), click-to-read, highlighting, popup.
//   Edge voices:   EdgeEngine - Edge's free built-in "Online (Natural)" voices. The popup offers them
//                  only when the browser actually has them (Edge). Chrome's own voices don't report
//                  word boundaries, so word highlighting wouldn't work with them.
//   Default voice: Edge's Jenny in Edge, Kokoro's Heart elsewhere (both need no setup).

const IS_EDGE =
  navigator.userAgentData?.brands.some((b) => b.brand === 'Microsoft Edge') ||
  navigator.userAgent.includes('Edg/');
const DEFAULT_VOICE = IS_EDGE ? 'edge:Microsoft Jenny Online (Natural) - English (United States)' : 'web:af_heart';
