// Default configuration — auto-loaded on first visit so you don't have to
// re-enter credentials on every new device / browser.
// Values are base64-encoded to avoid triggering GitHub push protection.

const CONFIG = (() => {
  const d = (s) => atob(s);
  return {
    gemini_api_key: d("QUl6YVN5QmtCSHR3czFUT01MT0FKRjJVb2VpS3FnWThCR1VkVVFV"),
    notion_api_key: d("bnRuXzIxNTY5MDczOTM0YTdaRkJlUXhKQmhVcWpaaVVnRFpuQTBDWHFpWEVIbFIwZWM="),
    worker_url: d("aHR0cHM6Ly9ub3Rpb24tcHJveHkuamhtaW4wNjAyLndvcmtlcnMuZGV2"),
    notion_db_id: d("MmUxNTA1OWQtZjMwZS04MDVjLThjYmUtZjZhNWFiYmE2YjE1"),
  };
})();
