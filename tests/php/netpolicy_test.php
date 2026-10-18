<?php
/**
 * Unit tests for the Bludit Wizard network policy (wizard/lib/netpolicy.php).
 *
 * Dependency-free: runs with any PHP 8 CLI, no Bludit, no cURL, no network.
 * Prints TAP-ish lines and exits non-zero on failure.
 *
 * Usage: php tests/php/netpolicy_test.php
 */

require __DIR__ . '/../../wizard/lib/netpolicy.php';

$pass = 0;
$fail = 0;

function ok($name, $condition, $expected = '', $actual = '')
{
    global $pass, $fail;
    if ($condition) {
        $pass++;
        echo "  PASS  $name\n";
    } else {
        $fail++;
        echo "  FAIL  $name  (expected: " . json_encode($expected) . " | actual: " . json_encode($actual) . ")\n";
    }
}

function is($name, $actual, $expected)
{
    ok($name, $actual === $expected, $expected, $actual);
}

echo "[netpolicy] classify IPv4\n";
is('127.0.0.1 loopback', BluditWizardNetPolicy::classifyIp('127.0.0.1'), 'loopback');
is('127.255.255.254 loopback', BluditWizardNetPolicy::classifyIp('127.255.255.254'), 'loopback');
is('10.0.0.1 private', BluditWizardNetPolicy::classifyIp('10.0.0.1'), 'private');
is('172.16.0.1 private', BluditWizardNetPolicy::classifyIp('172.16.0.1'), 'private');
is('192.168.1.1 private', BluditWizardNetPolicy::classifyIp('192.168.1.1'), 'private');
is('100.64.0.1 private', BluditWizardNetPolicy::classifyIp('100.64.0.1'), 'private');
is('169.254.169.254 blocked (metadata)', BluditWizardNetPolicy::classifyIp('169.254.169.254'), 'blocked');
is('169.254.1.1 blocked (link-local)', BluditWizardNetPolicy::classifyIp('169.254.1.1'), 'blocked');
is('0.0.0.0 blocked', BluditWizardNetPolicy::classifyIp('0.0.0.0'), 'blocked');
is('224.0.0.1 blocked (multicast)', BluditWizardNetPolicy::classifyIp('224.0.0.1'), 'blocked');
is('240.0.0.1 blocked (reserved)', BluditWizardNetPolicy::classifyIp('240.0.0.1'), 'blocked');
is('192.0.2.1 blocked (doc)', BluditWizardNetPolicy::classifyIp('192.0.2.1'), 'blocked');
is('198.51.100.1 blocked (doc)', BluditWizardNetPolicy::classifyIp('198.51.100.1'), 'blocked');
is('203.0.113.1 blocked (doc)', BluditWizardNetPolicy::classifyIp('203.0.113.1'), 'blocked');
is('8.8.8.8 public', BluditWizardNetPolicy::classifyIp('8.8.8.8'), 'public');
is('1.1.1.1 public', BluditWizardNetPolicy::classifyIp('1.1.1.1'), 'public');

echo "[netpolicy] classify IPv6\n";
is('::1 loopback', BluditWizardNetPolicy::classifyIp('::1'), 'loopback');
is('fe80::1 blocked (link-local)', BluditWizardNetPolicy::classifyIp('fe80::1'), 'blocked');
is('fc00::1 private (ULA)', BluditWizardNetPolicy::classifyIp('fc00::1'), 'private');
is('fd00::1 private (ULA)', BluditWizardNetPolicy::classifyIp('fd00::1'), 'private');
is('fd00:ec2::254 blocked (metadata)', BluditWizardNetPolicy::classifyIp('fd00:ec2::254'), 'blocked');
is('2606:4700:4700::1111 public', BluditWizardNetPolicy::classifyIp('2606:4700:4700::1111'), 'public');
is('::ffff:127.0.0.1 -> loopback (mapped)', BluditWizardNetPolicy::classifyIp('::ffff:127.0.0.1'), 'loopback');
is('::ffff:10.0.0.1 -> private (mapped)', BluditWizardNetPolicy::classifyIp('::ffff:10.0.0.1'), 'private');
is('::ffff:169.254.169.254 -> blocked (mapped)', BluditWizardNetPolicy::classifyIp('::ffff:169.254.169.254'), 'blocked');
is('64:ff9b::7f00:1 blocked (NAT64)', BluditWizardNetPolicy::classifyIp('64:ff9b::7f00:1'), 'blocked');
is('2002:7f00:1::1 blocked (6to4)', BluditWizardNetPolicy::classifyIp('2002:7f00:1::1'), 'blocked');
is('2001::1 blocked (Teredo)', BluditWizardNetPolicy::classifyIp('2001::1'), 'blocked');
is('2001:db8::1 blocked (doc)', BluditWizardNetPolicy::classifyIp('2001:db8::1'), 'blocked');
is('ff02::1 blocked (multicast)', BluditWizardNetPolicy::classifyIp('ff02::1'), 'blocked');

echo "[netpolicy] alternate IPv4 encodings\n";
is('2130706433 -> 127.0.0.1', BluditWizardNetPolicy::normalizeNumericHost('2130706433'), '127.0.0.1');
is('3232235777 -> 192.168.1.1', BluditWizardNetPolicy::normalizeNumericHost('3232235777'), '192.168.1.1');
is('167772161 -> 10.0.0.1', BluditWizardNetPolicy::normalizeNumericHost('167772161'), '10.0.0.1');
is('0x7f.0.0.1 -> 127.0.0.1', BluditWizardNetPolicy::normalizeNumericHost('0x7f.0.0.1'), '127.0.0.1');
is('0177.0.0.1 -> 127.0.0.1 (octal)', BluditWizardNetPolicy::normalizeNumericHost('0177.0.0.1'), '127.0.0.1');
is('127.1 -> 127.0.0.1 (short)', BluditWizardNetPolicy::normalizeNumericHost('127.1'), '127.0.0.1');
is('0x0a000001 -> 10.0.0.1', BluditWizardNetPolicy::normalizeNumericHost('0x0a000001'), '10.0.0.1');
is('example.com not numeric', BluditWizardNetPolicy::normalizeNumericHost('example.com'), null);
is('1.2.3.4.5 not numeric', BluditWizardNetPolicy::normalizeNumericHost('1.2.3.4.5'), null);

echo "[netpolicy] classify host\n";
is('localhost -> loopback-name', BluditWizardNetPolicy::classifyHost('localhost'), 'loopback-name');
is('metadata.google.internal blocked', BluditWizardNetPolicy::classifyHost('metadata.google.internal'), 'blocked');
is('metadata.goog blocked', BluditWizardNetPolicy::classifyHost('metadata.goog'), 'blocked');
is('mockai -> private-name', BluditWizardNetPolicy::classifyHost('mockai'), 'private-name');
is('api.openai.com -> public-name', BluditWizardNetPolicy::classifyHost('api.openai.com'), 'public-name');
is('2130706433 -> loopback', BluditWizardNetPolicy::classifyHost('2130706433'), 'loopback');
is('0x0a000001 -> private', BluditWizardNetPolicy::classifyHost('0x0a000001'), 'private');
is('127.0.0.1. -> loopback (trailing dot)', BluditWizardNetPolicy::classifyHost('127.0.0.1.'), 'loopback');
is('[::ffff:10.0.0.1] -> private', BluditWizardNetPolicy::classifyHost('[::ffff:10.0.0.1]'), 'private');

echo "[netpolicy] screen resolved addresses (fail-closed)\n";
is('public only -> ok', BluditWizardNetPolicy::screenIps(array('8.8.8.8'), false)['ok'], true);
is('loopback allowed', BluditWizardNetPolicy::screenIps(array('127.0.0.1'), false)['ok'], true);
is('private refused by default', BluditWizardNetPolicy::screenIps(array('10.0.0.1'), false)['ok'], false);
is('private allowed with opt-in', BluditWizardNetPolicy::screenIps(array('192.168.1.5'), true)['ok'], true);
is('MIXED public+private refused', BluditWizardNetPolicy::screenIps(array('8.8.8.8', '10.0.0.1'), false)['ok'], false);
is('MIXED public+private refused even with opt-in? (private allowed -> ok)', BluditWizardNetPolicy::screenIps(array('8.8.8.8', '10.0.0.1'), true)['ok'], true);
is('MIXED public+metadata refused even with opt-in', BluditWizardNetPolicy::screenIps(array('8.8.8.8', '169.254.169.254'), true)['ok'], false);
is('metadata IPv6 refused even with opt-in', BluditWizardNetPolicy::screenIps(array('fd00:ec2::254'), true)['ok'], false);
is('link-local refused even with opt-in', BluditWizardNetPolicy::screenIps(array('169.254.1.1'), true)['ok'], false);
is('NAT64 refused even with opt-in', BluditWizardNetPolicy::screenIps(array('64:ff9b::7f00:1'), true)['ok'], false);
is('empty list refused', BluditWizardNetPolicy::screenIps(array(), true)['ok'], false);

echo "[netpolicy] resolve entries / pinning (fail-closed)\n";
$noPin = BluditWizardNetPolicy::resolveEntries('api.openai.com', 443, array('8.8.8.8'), false, false);
is('no pinning -> refuse', $noPin['ok'], false);
$pin = BluditWizardNetPolicy::resolveEntries('api.openai.com', 443, array('8.8.8.8'), true, false);
is('pinning ok', $pin['ok'], true);
is('pinning entry v4', $pin['entries'][0], 'api.openai.com:443:8.8.8.8');
$pin6 = BluditWizardNetPolicy::resolveEntries('api.openai.com', 443, array('2606:4700:4700::1111'), true, false);
is('pinning entry v6 bracketed', $pin6['entries'][0], 'api.openai.com:443:[2606:4700:4700::1111]');
$pinBad = BluditWizardNetPolicy::resolveEntries('api.openai.com', 443, array('169.254.169.254'), true, true);
is('pinning refuses metadata', $pinBad['ok'], false);
$pinEmpty = BluditWizardNetPolicy::resolveEntries('api.openai.com', 443, array(), true, false);
is('pinning refuses empty', $pinEmpty['ok'], false);

echo "[netpolicy] validate provider URL\n";
is('https public valid', BluditWizardNetPolicy::validateProviderUrl('https://api.openai.com/v1', false)['valid'], true);
is('http public invalid (https required)', BluditWizardNetPolicy::validateProviderUrl('http://api.openai.com/v1', false)['valid'], false);
is('https openrouter valid', BluditWizardNetPolicy::validateProviderUrl('https://openrouter.ai/api/v1', false)['valid'], true);
is('https llmgateway valid', BluditWizardNetPolicy::validateProviderUrl('https://api.llmgateway.io/v1', false)['valid'], true);
is('loopback http valid', BluditWizardNetPolicy::validateProviderUrl('http://127.0.0.1:11434/v1', false)['valid'], true);
is('localhost http valid', BluditWizardNetPolicy::validateProviderUrl('http://localhost:11434/v1', false)['valid'], true);
is('numeric loopback valid', BluditWizardNetPolicy::validateProviderUrl('http://2130706433/v1', false)['valid'], true);
is('numeric loopback normalized to 127.0.0.1', BluditWizardNetPolicy::validateProviderUrl('http://2130706433/v1', false)['normalized'], 'http://127.0.0.1/v1');
is('numeric private blocked', BluditWizardNetPolicy::validateProviderUrl('http://167772161/v1', false)['valid'], false);
is('hex private blocked', BluditWizardNetPolicy::validateProviderUrl('http://0x0a000001/v1', false)['valid'], false);
is('private-name blocked by default', BluditWizardNetPolicy::validateProviderUrl('http://mockai:8090/v1', false)['valid'], false);
is('private-name allowed with opt-in', BluditWizardNetPolicy::validateProviderUrl('http://mockai:8090/v1', true)['valid'], true);
is('private IP allowed with opt-in', BluditWizardNetPolicy::validateProviderUrl('http://192.168.1.50/v1', true)['valid'], true);
is('metadata IP blocked', BluditWizardNetPolicy::validateProviderUrl('http://169.254.169.254/v1', false)['valid'], false);
is('metadata host blocked', BluditWizardNetPolicy::validateProviderUrl('http://metadata.google.internal/v1', false)['valid'], false);
is('metadata host blocked even with opt-in', BluditWizardNetPolicy::validateProviderUrl('https://metadata.google.internal/v1', true)['valid'], false);
is('mapped IPv6 private blocked', BluditWizardNetPolicy::validateProviderUrl('https://[::ffff:10.0.0.1]/v1', false)['valid'], false);
is('NAT64 blocked', BluditWizardNetPolicy::validateProviderUrl('https://[64:ff9b::a00:1]/v1', false)['valid'], false);
is('file scheme blocked', BluditWizardNetPolicy::validateProviderUrl('file:///etc/passwd', false)['valid'], false);
is('credentials blocked', BluditWizardNetPolicy::validateProviderUrl('https://user:pass@api.openai.com/v1', false)['valid'], false);
is('query string blocked', BluditWizardNetPolicy::validateProviderUrl('https://api.openai.com/v1?x=1', false)['valid'], false);
is('IPv6 loopback valid + bracketed', BluditWizardNetPolicy::validateProviderUrl('http://[::1]:11434/v1', false)['normalized'], 'http://[::1]:11434/v1');

echo "[netpolicy] DNS parsing (deterministic synthetic responses)\n";
function bw_makeDns($id, $name, array $answers)
{
    $header = pack('n', $id) . pack('n', 0x8180) . pack('n', 1) . pack('n', count($answers)) . pack('n', 0) . pack('n', 0);
    $question = BluditWizardNetPolicy::dnsEncodeName($name) . pack('n', 1) . pack('n', 1);
    $records = '';
    foreach ($answers as $a) {
        if ($a[0] === 'A') {
            $records .= "\xc0\x0c" . pack('n', 1) . pack('n', 1) . pack('N', 60) . pack('n', 4) . inet_pton($a[1]);
        } else {
            $records .= "\xc0\x0c" . pack('n', 28) . pack('n', 1) . pack('N', 60) . pack('n', 16) . inet_pton($a[1]);
        }
    }
    return $header . $question . $records;
}
$respA = bw_makeDns(0x2222, 'evil.example.com', array(array('A', '93.184.216.34')));
$parsed = BluditWizardNetPolicy::parseDnsAnswers($respA, 0x2222);
is('parse single A', $parsed, array('93.184.216.34'));
$respMulti = bw_makeDns(0x3333, 'multi.example.com', array(array('A', '1.1.1.1'), array('A', '8.8.8.8')));
is('parse multiple A', BluditWizardNetPolicy::parseDnsAnswers($respMulti, 0x3333), array('1.1.1.1', '8.8.8.8'));
$respAAAA = bw_makeDns(0x4444, 'v6.example.com', array(array('AAAA', '2606:4700:4700::1111')));
is('parse AAAA', BluditWizardNetPolicy::parseDnsAnswers($respAAAA, 0x4444), array('2606:4700:4700::1111'));
is('wrong transaction id -> no answers', BluditWizardNetPolicy::parseDnsAnswers($respA, 0x9999), array());
is('truncated packet -> no answers', BluditWizardNetPolicy::parseDnsAnswers(substr($respA, 0, 6), 0x2222), array());
is('dnsEncodeName', bin2hex(BluditWizardNetPolicy::dnsEncodeName('a.bc')), '016102626300');
is('dnsEncodeName rejects empty label', BluditWizardNetPolicy::dnsEncodeName('a..b'), false);

echo "[netpolicy] bounded DNS timeout (black-hole resolver 192.0.2.1)\n";
$t0 = microtime(true);
$ips = BluditWizardNetPolicy::dnsQuery('example.test', 1, array('192.0.2.1'), 1.0);
$elapsed = microtime(true) - $t0;
ok('black-hole resolver returns no answers', $ips === array(), array(), $ips);
ok('black-hole resolver is bounded (<2.5s for a 1.0s budget)', $elapsed < 2.5, '<2.5', round($elapsed, 2));
$t1 = microtime(true);
$res = BluditWizardNetPolicy::resolveHost('example.test', array('192.0.2.1'), 1.0);
$elapsed1 = microtime(true) - $t1;
is('resolveHost fails closed on timeout', $res['ok'], false);
ok('resolveHost is bounded (<3.0s)', $elapsed1 < 3.0, '<3.0', round($elapsed1, 2));

echo "\n[netpolicy] PASS $pass  FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
