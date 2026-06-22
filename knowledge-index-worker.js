const { parentPort, workerData } = require('worker_threads');
const knowledge = require('./knowledge');

try {
  const { platform, question, threshold } = workerData;
  const result = knowledge.search(platform, question, threshold);
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error.message });
}
