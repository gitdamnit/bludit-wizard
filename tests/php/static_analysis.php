<?php
/**
 * Lightweight static analysis for the Bludit Wizard plugin, run with a PHP CLI.
 *
 * Usage: php static_analysis.php /path/to/plugin.php
 * Output: JSON on stdout. Exit code 1 when a disallowed construct is found.
 *
 * This is intentionally dependency-free so it can run inside any PHP image.
 */

$path = isset($argv[1]) ? $argv[1] : '/var/www/html/bl-plugins/wizard/plugin.php';
if (!is_file($path)) {
    fwrite(STDERR, "file not found: {$path}\n");
    exit(2);
}
$src = file_get_contents($path);

// Functions that would indicate shell execution, dynamic code or unsafe
// deserialisation in a CMS plugin. None are expected here.
$disallowed = array(
    'eval', 'exec', 'shell_exec', 'system', 'passthru', 'popen', 'proc_open',
    'pcntl_exec', 'assert', 'create_function', 'extract', 'unserialize',
    'call_user_func', 'preg_replace_callback' // noted, not fatal
);
$hardFail = array('eval', 'exec', 'shell_exec', 'system', 'passthru', 'popen',
    'proc_open', 'pcntl_exec', 'create_function', 'extract', 'unserialize');

$found = array();
foreach ($disallowed as $fn) {
    if (preg_match('/\b' . preg_quote($fn, '/') . '\s*\(/i', $src)) {
        $found[] = $fn;
    }
}
$hardFound = array_values(array_intersect($found, $hardFail));

$report = array(
    'file' => $path,
    'bytes' => strlen($src),
    'disallowed_functions' => $found,
    'hard_failures' => $hardFound,
    'uses_htmlspecialchars' => (bool) preg_match('/htmlspecialchars\s*\(/', $src),
    'uses_hash_equals' => (bool) preg_match('/hash_equals\s*\(/', $src),
    'uses_core_page_api' => (bool) preg_match('/\b(createPage|editPage|deletePage|buildPage)\s*\(/', $src),
    'declares_beforeAll' => (bool) preg_match('/function\s+beforeAll\s*\(/', $src),
    'declares_adminController' => (bool) preg_match('/function\s+adminController\s*\(/', $src),
    'has_bearer_auth' => (bool) preg_match('/Bearer\\s/', $src),
    'redeclares_isValidCsrf' => (bool) preg_match('/function\s+isValidCsrf\s*\(/', $src),
);

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;

exit(empty($hardFound) ? 0 : 1);
