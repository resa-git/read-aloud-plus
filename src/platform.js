// The ONE place that decides what differs between Edge and Chrome.
//
//   Both browsers: AzureEngine (your subscription), click-to-read, highlighting, popup.
//   Edge only:     EdgeEngine - Edge's free built-in "Online (Natural)" voices.
//                  Chrome has the same Web Speech API, but its voices don't report
//                  word boundaries, so word highlighting wouldn't work there.

const IS_EDGE =
  navigator.userAgentData?.brands.some((b) => b.brand === 'Microsoft Edge') ??
  navigator.userAgent.includes('Edg/'); // userAgentData is missing on plain-http pages
