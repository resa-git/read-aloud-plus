// The ONE place that decides what differs between Edge and Chrome.
//
//   Both browsers: Azure and Kokoro voices, click-to-read, highlighting, popup.
//   Edge voices:   EdgeEngine - Edge's free built-in "Online (Natural)" voices. The popup offers them
//                  only when the browser actually has them (Edge). Chrome's own voices don't report
//                  word boundaries, so word highlighting wouldn't work with them.
//   Default voice: Edge's Jenny in Edge (free, no setup), Kokoro's Heart elsewhere.

const IS_EDGE =
  navigator.userAgentData?.brands.some((b) => b.brand === 'Microsoft Edge') ||
  navigator.userAgent.includes('Edg/');
const DEFAULT_VOICE = IS_EDGE ? 'edge:Microsoft Jenny Online (Natural) - English (United States)' : 'local:af_heart';
