<?php
/**
 * Bludit Wizard
 * Native AI-assisted site management for Bludit 3.x
 *
 * @package BluditWizard
 * @copyright 2026 Evan Zellner
 * @license GPL-3.0-only
 */

class pluginWizard extends Plugin
{
    /**
     * Cache-busting version for the plugin's static assets.
     *
     * Bludit core versions its own assets (e.g. bludit.css?version=3.22.0).
     * The plugin does the same so an upgraded directory cannot keep serving a
     * previously cached wizard.js/settings.js to the browser.
     */
    const ASSET_VERSION = '1.1.0';

    /**
     * Message shown when a non-AJAX (native) form POST reaches the controller.
     * Set by adminController() and rendered by adminView().
     */
    private $adminNotice = '';

    private function assetUrl($path)
    {
        return HTML_PATH_PLUGINS . 'wizard/' . ltrim((string)$path, '/') . '?v=' . rawurlencode(self::ASSET_VERSION);
    }

    /**
     * Load the network-policy library on demand.
     *
     * The library must NOT be included while Bludit is scanning plugin files:
     * Bludit instantiates every class declared during that scan as if it were a
     * plugin, so a helper class declared at load time breaks plugin discovery.
     * Requiring it lazily (inside the methods that use it) keeps it invisible to
     * that scan.
     */
    private function policy()
    {
        if (!class_exists('BluditWizardNetPolicy')) {
            require_once __DIR__ . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'netpolicy.php';
        }
        return 'BluditWizardNetPolicy';
    }

    public function init()
    {
        $this->dbFields = array(
            'provider' => 'openai',
            'baseUrl' => 'https://api.openai.com/v1',
            'model' => 'gpt-4o-mini',
            'apiKey' => '',
            'wizardApiKey' => '',
            'temperature' => '0.3',
            'maxTokens' => '2500',
            'systemPrompt' => 'You are Bludit Wizard, a careful CMS assistant. Prefer minimal, reversible changes. Never invent site facts. Return concise, production-ready content.',
            // Private-network providers default to off. See DECISION_LOG D-020/D-036.
            'allowPrivateProviders' => false
        );
    }

    /**
     * Bludit plugin settings form.
     *
     * Bludit renders this method under Settings -> Plugins -> Wizard -> Settings.
     * The submitted fields are automatically persisted to $this->dbFields.
     */
    public function form()
    {
        global $security;

        $provider = (string)$this->getValue('provider');
        $baseUrl = htmlspecialchars((string)$this->getValue('baseUrl'), ENT_QUOTES, 'UTF-8');
        $model = htmlspecialchars((string)$this->getValue('model'), ENT_QUOTES, 'UTF-8');
        // Saved secrets are never echoed back into the page. Empty submissions
        // keep the stored value (see post()).
        $apiKeySet = trim((string)$this->getValue('apiKey')) !== '';
        $wizardApiKeySet = trim((string)$this->getValue('wizardApiKey')) !== '';
        $allowPrivateProviders = ($this->getValue('allowPrivateProviders') === true);
        $temperature = htmlspecialchars((string)$this->getValue('temperature'), ENT_QUOTES, 'UTF-8');
        $maxTokens = htmlspecialchars((string)$this->getValue('maxTokens'), ENT_QUOTES, 'UTF-8');
        $systemPrompt = htmlspecialchars((string)$this->getValue('systemPrompt'), ENT_QUOTES, 'UTF-8');

        $presets = $this->providerPresets();
        $catalog = $this->getModelsCacheForForm();
        $tokenCSRF = (isset($security) && is_object($security) && method_exists($security, 'getTokenCSRF'))
            ? (string)$security->getTokenCSRF() : '';

        $html = '';
        $html .= '<link rel="stylesheet" href="' . $this->assetUrl('css/wizard.css') . '">';
        $html .= '<div class="form-group">';
        $html .= '<label for="wizard-provider">Provider preset</label>';
        $html .= '<select class="form-control" id="wizard-provider" name="provider">';
        foreach ($presets as $value => $preset) {
            $selected = ((string)$provider === (string)$value) ? ' selected' : '';
            $html .= '<option value="' . htmlspecialchars($value, ENT_QUOTES, 'UTF-8') . '"' . $selected . '>' . htmlspecialchars($preset['label'], ENT_QUOTES, 'UTF-8') . '</option>';
        }
        $html .= '</select>';
        $html .= '<small class="form-text text-muted">Choosing a preset fills the Base URL, which you can still edit. All providers are used through the OpenAI-compatible <code>/chat/completions</code> and <code>/models</code> endpoints.</small>';
        $html .= '</div>';

        $html .= '<div class="form-group">';
        $html .= '<label for="wizard-base-url">Base URL</label>';
        $html .= '<input class="form-control" id="wizard-base-url" type="url" name="baseUrl" value="' . $baseUrl . '" placeholder="https://api.openai.com/v1">';
        $html .= '<small class="form-text text-muted">For OpenAI, use <code>https://api.openai.com/v1</code>.</small>';
        $html .= '</div>';

        $html .= '<div class="form-group bw-model-group">';
        $html .= '<label for="wizard-model">Model</label>';
        $html .= '<div class="bw-model-row">';
        $html .= '<input class="form-control" id="wizard-model" name="model" type="text" value="' . $model . '" placeholder="Type a model id or pick one from the live catalog" autocomplete="off">';
        $html .= '<button type="button" class="btn btn-outline-secondary" id="bw-refresh-models">Refresh models</button>';
        $html .= '<button type="button" class="btn btn-outline-secondary" id="bw-test-model">Test model</button>';
        $html .= '</div>';
        $html .= '<div class="bw-model-menu" id="bw-model-menu" hidden></div>';
        $html .= '<div class="bw-model-filters">';
        $html .= '<label class="bw-check" id="bw-filter-free-wrap" hidden><input type="checkbox" id="bw-filter-free"> Free models only</label>';
        $html .= '<label class="bw-check" id="bw-filter-tools-wrap" hidden><input type="checkbox" id="bw-filter-tools"> Tool support only</label>';
        $html .= '</div>';
        $html .= '<div class="bw-model-status" id="bw-model-status"><span class="text-muted">No catalog loaded yet — click <b>Refresh models</b> to retrieve it from the provider.</span></div>';
        $html .= '<small class="form-text text-muted">Discovery never changes the saved model. Manual entry always works as a fallback.</small>';
        $html .= '</div>';

        $html .= '<div class="form-group">';
        $html .= '<label for="wizard-api-key">LLM API key</label>';
        $html .= '<input class="form-control" id="wizard-api-key" type="password" name="apiKey" value="" placeholder="' . ($apiKeySet ? '•••••• saved — leave blank to keep' : 'Paste your provider API key') . '" autocomplete="new-password">';
        $html .= '<small class="form-text text-muted">Used only for the AI provider configured above. For security the saved key is never shown again; leave this blank to keep it.</small>';
        $html .= '</div>';

        $html .= '<div class="form-group">';
        $html .= '<label for="wizard-gpt-api-key">GPT Action API key</label>';
        $html .= '<div class="bw-model-row">';
        $html .= '<input class="form-control" id="wizard-gpt-api-key" type="password" name="wizardApiKey" value="" placeholder="' . ($wizardApiKeySet ? '•••••• saved — leave blank to keep' : 'Create or generate a secret') . '" autocomplete="new-password">';
        $html .= '<button type="button" class="btn btn-outline-secondary" id="bw-generate-gpt-key">Generate</button>';
        $html .= '</div>';
        $html .= '<small class="form-text text-muted">A separate secret used by your Custom GPT to access this site. It is stored on the server and never shown again — copy a generated value before saving. Leave blank to keep the current key.</small>';
        $html .= '</div>';

        $html .= '<div class="row">';
        $html .= '<div class="col-md-6"><div class="form-group">';
        $html .= '<label for="wizard-temperature">Temperature</label>';
        $html .= '<input class="form-control" id="wizard-temperature" type="number" min="0" max="2" step="0.1" name="temperature" value="' . $temperature . '">';
        $html .= '</div></div>';
        $html .= '<div class="col-md-6"><div class="form-group">';
        $html .= '<label for="wizard-max-tokens">Max tokens</label>';
        $html .= '<input class="form-control" id="wizard-max-tokens" type="number" min="256" max="100000" step="1" name="maxTokens" value="' . $maxTokens . '">';
        $html .= '</div></div>';
        $html .= '</div>';

        $html .= '<div class="form-group">';
        $html .= '<label for="wizard-system-prompt">System prompt</label>';
        $html .= '<textarea class="form-control" id="wizard-system-prompt" name="systemPrompt" rows="7">' . $systemPrompt . '</textarea>';
        $html .= '</div>';

        $html .= '<div class="form-group bw-safety-toggles">';
        $html .= '<label class="bw-check bw-check-block">';
        $html .= '<input type="hidden" name="allowPrivateProviders" value="false">';
        $html .= '<input type="checkbox" id="wizard-allow-private-providers" name="allowPrivateProviders" value="true"' . ($allowPrivateProviders ? ' checked' : '') . '> ';
        $html .= '<b>Allow private-network provider hosts</b>';
        $html .= '</label>';
        $html .= '<small class="form-text text-muted">Off by default. Loopback (<code>127.0.0.1</code>, <code>localhost</code>) and public HTTPS providers are always allowed. Enable this only for a trusted provider on your own LAN (for example Ollama on <code>192.168.x.x</code>).</small>';
        $html .= '</div>';

        $html .= '<div class="alert alert-info">';
        $html .= '<strong>After saving:</strong> open <b>Wizard</b> from the admin sidebar and run a simple “Ask the Wizard” test. The plugin will report provider errors directly if the API request fails.';
        $html .= '</div>';
        $html .= '<div class="alert alert-secondary">';
        $html .= '<strong>Custom GPT:</strong> if a GPT Action should manage this site, set the GPT Action authentication to <b>API Key → Bearer</b> and use the separate GPT Action key above. The action base URL is <code>' . htmlspecialchars($this->getWizardApiBaseUrl(), ENT_QUOTES, 'UTF-8') . '</code>.';
        $html .= '</div>';

        // Client bootstrap. JSON_HEX_* keeps the payload safe inside a <script>
        // element even if a provider returns a hostile model name.
        $presetBases = array();
        foreach ($presets as $value => $preset) {
            $presetBases[$value] = $preset['baseUrl'];
        }
        $settings = array(
            'endpoint' => HTML_PATH_ADMIN_ROOT . 'plugin/pluginwizard',
            'token' => $tokenCSRF,
            'provider' => $provider,
            'presets' => $presetBases,
            'catalog' => array(
                'models' => $catalog['models'],
                'hasPricing' => $catalog['hasPricing'],
                'hasTools' => $catalog['hasTools'],
                'count' => $catalog['count'],
                'fetchedAt' => $catalog['fetchedAt'],
                'stale' => $catalog['stale']
            )
        );
        $html .= '<script>window.BW_SETTINGS=' . json_encode($settings, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) . ';</script>';
        $html .= '<script src="' . $this->assetUrl('js/settings.js') . '"></script>';

        return $html;
    }


    /**
     * Persist settings without wiping secrets that were left blank.
     *
     * The key fields are rendered empty (the stored secret is never echoed
     * back), so an empty submission must keep the existing value instead of
     * clearing it. All other fields keep Bludit's normal behaviour.
     */
    public function post()
    {
        $preserve = array();
        foreach (array('apiKey', 'wizardApiKey') as $field) {
            $submitted = isset($_POST[$field]) ? (string)$_POST[$field] : '';
            if (trim($submitted) === '') {
                $current = isset($this->db[$field]) ? $this->db[$field] : $this->dbFields[$field];
                if ($current !== false && $current !== null && $current !== '') {
                    $preserve[$field] = $current;
                }
            }
        }

        $saved = parent::post();

        if (!empty($preserve)) {
            foreach ($preserve as $field => $value) {
                $this->db[$field] = $value;
            }
            $saved = $this->save();
        }

        return $saved;
    }

    /**
     * Public, API-key-protected interface for Custom GPT Actions.
     *
     * Routes:
     *   GET    /api/wizard/site
     *   GET    /api/wizard/pages
     *   GET    /api/wizard/pages/{key}
     *   POST   /api/wizard/pages
     *   PUT    /api/wizard/pages/{key}
     *
     * Page deletion is deliberately not part of this API (see DECISION_LOG
     * D-0038). A DELETE request is refused with 405.
     */
    public function beforeAll()
    {
        $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
        $path = parse_url($requestUri, PHP_URL_PATH);
        if (!is_string($path)) {
            return;
        }

        // Bludit may be installed in a subdirectory. Strip the installation
        // base path from the request so the API matches at any depth, e.g.
        // /blog/api/wizard/site. HTML_PATH_ROOT is '/' for a root install.
        if (defined('HTML_PATH_ROOT')) {
            $root = rtrim((string)HTML_PATH_ROOT, '/');
            if ($root !== '' && strpos($path, $root . '/') === 0) {
                $path = substr($path, strlen($root));
            }
        }

        $base = '/api/wizard';
        $normalized = rtrim($path, '/');
        if ($normalized !== $base && strpos($normalized, $base . '/') !== 0) {
            return;
        }

        // Never serve the GPT API without an explicit secret.
        $configuredKey = trim((string)$this->getValue('wizardApiKey'));
        if ($configuredKey === '') {
            $this->json(array(
                'ok' => false,
                'error' => 'Bludit Wizard GPT API is not configured. Add a GPT Action API key in the plugin settings.'
            ), 503);
        }

        $providedKey = $this->getBearerToken();
        if ($providedKey === '' || !hash_equals($configuredKey, $providedKey)) {
            $this->json(array('ok' => false, 'error' => 'Unauthorized.'), 401, array('WWW-Authenticate: Bearer'));
        }

        // Reject browsers and cross-origin callers that are not the API client.
        if (!in_array($_SERVER['REQUEST_METHOD'], array('GET', 'POST', 'PUT', 'DELETE'), true)) {
            $this->json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }

        $suffix = substr($normalized, strlen($base));
        $suffix = trim($suffix, '/');
        $segments = $suffix === '' ? array() : array_map('rawurldecode', explode('/', $suffix));
        $method = strtoupper($_SERVER['REQUEST_METHOD']);

        if (count($segments) === 1 && $segments[0] === 'site' && $method === 'GET') {
            $this->gptSite();
        }

        if (count($segments) === 1 && $segments[0] === 'pages') {
            if ($method === 'GET') {
                $this->gptListPages();
            }
            if ($method === 'POST') {
                $this->gptCreatePage();
            }
        }

        if (count($segments) === 2 && $segments[0] === 'pages') {
            $key = $segments[1];
            if ($key === '') {
                $this->json(array('ok' => false, 'error' => 'Page key is required.'), 400);
            }
            if ($method === 'GET') {
                $this->gptGetPage($key);
            }
            if ($method === 'PUT') {
                $this->gptUpdatePage($key);
            }
            if ($method === 'DELETE') {
                // Bludit Wizard is not a page-deletion interface. Native
                // deletion remains available in Bludit's own Content screen.
                $this->json(array(
                    'ok' => false,
                    'error' => 'Page deletion is not available through Bludit Wizard. Use the Bludit admin Content screen.',
                    'code' => 'deletion_not_supported'
                ), 405);
            }
        }

        $this->json(array('ok' => false, 'error' => 'Unknown Wizard API endpoint.'), 404);
    }

    private function getWizardApiBaseUrl()
    {
        global $site;
        $url = '';
        if (isset($site) && is_object($site) && method_exists($site, 'url')) {
            $url = rtrim((string)$site->url(), '/');
        }
        if ($url === '' && isset($_SERVER['HTTP_HOST'])) {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $url = $scheme . '://' . $_SERVER['HTTP_HOST'];
        }
        return $url . '/api/wizard';
    }

    private function getBearerToken()
    {
        $header = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $header = trim((string)$_SERVER['HTTP_AUTHORIZATION']);
        } elseif (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $name => $value) {
                if (strcasecmp($name, 'Authorization') === 0) {
                    $header = trim((string)$value);
                    break;
                }
            }
        }

        if ($header !== '' && preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return trim($m[1]);
        }

        // Also accept a dedicated header for environments that strip Authorization.
        if (isset($_SERVER['HTTP_X_BLUDIT_WIZARD_KEY'])) {
            return trim((string)$_SERVER['HTTP_X_BLUDIT_WIZARD_KEY']);
        }

        return '';
    }

    private function readJsonBody()
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return array();
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            $this->json(array('ok' => false, 'error' => 'Request body must be valid JSON.'), 400);
        }
        return $data;
    }

    private function gptSite()
    {
        global $site, $pages;
        $keys = $pages->getDB(true);
        $this->json(array(
            'ok' => true,
            'site' => array(
                'title' => $site->title(),
                'description' => $site->description(),
                'url' => $site->url(),
                'totalPages' => count($keys)
            )
        ));
    }

    private function gptListPages()
    {
        global $pages;
        $items = array();
        foreach ($pages->getDB(true) as $key) {
            $page = buildPage($key);
            if (!$page) {
                continue;
            }
            $items[] = array(
                'key' => $key,
                'title' => $page->title(),
                'description' => $page->description(),
                'type' => $page->type(),
                'slug' => $page->slug(),
                'permalink' => $page->permalink()
            );
            if (count($items) >= 200) {
                break;
            }
        }
        $this->json(array('ok' => true, 'count' => count($items), 'pages' => $items));
    }

    private function gptGetPage($key)
    {
        global $pages;
        if (!$pages->exists($key)) {
            $this->json(array('ok' => false, 'error' => 'Page not found.', 'key' => $key), 404);
        }
        $page = buildPage($key);
        if (!$page) {
            $this->json(array('ok' => false, 'error' => 'Page could not be loaded.', 'key' => $key), 500);
        }
        $content = method_exists($page, 'contentRaw') ? $page->contentRaw() : $page->content();
        $this->json(array(
            'ok' => true,
            'page' => array(
                'key' => $key,
                'title' => $page->title(),
                'description' => $page->description(),
                'type' => $page->type(),
                'slug' => $page->slug(),
                'permalink' => $page->permalink(),
                'content' => $content,
                'contentRaw' => $content
            )
        ));
    }

    private function gptCreatePage()
    {
        $data = $this->readJsonBody();
        $title = isset($data['title']) ? trim((string)$data['title']) : '';
        $content = isset($data['content']) ? (string)$data['content'] : '';
        if ($title === '' || $content === '') {
            $this->json(array('ok' => false, 'error' => 'title and content are required.'), 400);
        }

        $type = isset($data['type']) ? trim((string)$data['type']) : 'draft';
        $allowedTypes = array('published', 'draft', 'static', 'sticky', 'scheduled');
        if (!in_array($type, $allowedTypes, true)) {
            $type = 'draft';
        }

        $payload = array(
            'title' => $title,
            'description' => isset($data['description']) ? trim((string)$data['description']) : '',
            'content' => $content,
            'type' => $type,
            'slug' => isset($data['slug']) ? trim((string)$data['slug']) : ''
        );
        if (isset($data['tags'])) $payload['tags'] = is_array($data['tags']) ? implode(',', $data['tags']) : (string)$data['tags'];
        if (isset($data['category'])) $payload['category'] = (string)$data['category'];
        if (isset($data['parent'])) $payload['parent'] = (string)$data['parent'];

        $newKey = $this->createPageAsAdministrator($payload);
        if ($newKey === false) {
            $this->json(array('ok' => false, 'error' => 'Bludit could not create the page.'), 500);
        }

        $verified = buildPage($newKey);
        if (!$verified) {
            $this->json(array('ok' => false, 'error' => 'Page was created but could not be verified.'), 500);
        }

        $this->json(array(
            'ok' => true,
            'message' => 'Page created and verified.',
            'page' => $this->pageSnapshot($verified, $newKey)
        ), 201);
    }

    /**
     * Bludit's core createPage() obtains the page author from the current
     * session. GPT Action requests authenticate with the Wizard Bearer key,
     * not an admin browser session, so temporarily provide an enabled admin
     * identity while the core creation routine runs.
     */
    private function createPageAsAdministrator($payload)
    {
        global $users;

        $username = '';
        if (isset($users) && is_object($users) && method_exists($users, 'keys')) {
            foreach ($users->keys() as $candidate) {
                try {
                    $user = new User($candidate);
                    if ($user->role() === 'admin' && $user->enabled()) {
                        $username = $candidate;
                        break;
                    }
                } catch (Exception $e) {
                    // Ignore invalid user records and continue searching.
                }
            }
        }

        if ($username === '') {
            return false;
        }

        $previousUsername = Session::get('username');
        Session::set('username', $username);

        try {
            $newKey = createPage($payload);
        } finally {
            if ($previousUsername !== false && $previousUsername !== '') {
                Session::set('username', $previousUsername);
            } else {
                Session::remove('username');
            }
        }

        return $newKey;
    }

    private function gptUpdatePage($key)
    {
        global $pages;
        if (!$pages->exists($key)) {
            $this->json(array('ok' => false, 'error' => 'Page not found.', 'key' => $key), 404);
        }
        $data = $this->readJsonBody();
        if (empty($data['confirm'])) {
            $this->json(array('ok' => false, 'error' => 'Update requires confirm=true after reviewing the existing page.'), 400);
        }
        $page = buildPage($key);
        if (!$page) {
            $this->json(array('ok' => false, 'error' => 'Page could not be loaded.', 'key' => $key), 500);
        }

        $title = array_key_exists('title', $data) ? trim((string)$data['title']) : $page->title();
        $description = array_key_exists('description', $data) ? trim((string)$data['description']) : $page->description();
        $content = array_key_exists('content', $data) ? (string)$data['content'] : (method_exists($page, 'contentRaw') ? $page->contentRaw() : $page->content());
        $type = array_key_exists('type', $data) ? trim((string)$data['type']) : $page->type();
        $slug = array_key_exists('slug', $data) ? trim((string)$data['slug']) : $page->slug();

        if ($title === '' || $content === '') {
            $this->json(array('ok' => false, 'error' => 'title and content cannot be empty.'), 400);
        }

        $allowedTypes = array('published', 'draft', 'static', 'sticky', 'scheduled');
        if (!in_array($type, $allowedTypes, true)) {
            $type = $page->type();
        }

        $result = editPage(array(
            'key' => $key,
            'title' => $title,
            'description' => $description,
            'content' => $content,
            'type' => $type,
            'slug' => $slug
        ));
        if ($result === false) {
            $this->json(array('ok' => false, 'error' => 'Bludit could not update the page.'), 500);
        }

        $verified = buildPage($result);
        if (!$verified) {
            $this->json(array('ok' => false, 'error' => 'Page was updated but could not be verified.'), 500);
        }

        $this->json(array(
            'ok' => true,
            'message' => 'Page updated and verified.',
            'page' => $this->pageSnapshot($verified, $result)
        ));
    }

    /**
     * True when the request came from the workspace's fetch() client.
     * Browser-native form posts do not send this header.
     */
    private function isAjaxAdminRequest()
    {
        return isset($_SERVER['HTTP_X_REQUESTED_WITH'])
            && strtolower((string)$_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
    }

    public function adminController()
    {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Bludit validates the CSRF token for every admin POST in
            // bl-kernel/boot/rules/99.security.php and redirects to the login
            // page when it is missing or invalid. That rule also removes
            // $_POST['tokenCSRF'] before this controller runs, so the plugin
            // must not re-read that key: the previous duplicate check always
            // failed and rejected every write action with "Invalid CSRF token".
            // Rely on Bludit's core CSRF enforcement instead.
            $action = isset($_POST['action']) ? Sanitize::html($_POST['action']) : '';

            // Defensive inference: the RC1 form temporarily lost its hidden
            // action field, so a native submission could arrive with a valid
            // task but no action. A task-bearing admin POST is an AI request;
            // CSRF and task validation still apply in handleAi(). Explicit
            // unknown actions are never inferred and remain rejected.
            if ($action === '' && isset($_POST['task'])) {
                $action = 'ai';
            }

            switch ($action) {
                case 'ai':
                    // A browser-native form POST (no fetch/XHR marker) means
                    // the workspace JavaScript did not initialize. Render the
                    // page with an actionable message instead of executing a
                    // task or returning raw JSON. See DECISION_LOG D-0051.
                    if (!$this->isAjaxAdminRequest()) {
                        $this->adminNotice = 'The Wizard interface did not finish loading, so nothing was run and nothing was saved. Reload the page (Ctrl/Cmd+Shift+R). If this keeps happening, the plugin JavaScript may be missing or cached — deploy the complete wizard/ directory.';
                        return;
                    }
                    $this->handleAi();
                    break;

                case 'save_page':
                    // Writes are only performed for the JavaScript review
                    // flow. A native POST must never save content.
                    if (!$this->isAjaxAdminRequest()) {
                        $this->adminNotice = 'Nothing was saved: the Wizard interface did not finish loading. Reload the page (Ctrl/Cmd+Shift+R) and apply the change again.';
                        return;
                    }
                    $this->savePage();
                    break;

                case 'delete_page':
                    // Bludit Wizard is not a page-deletion interface.
                    $this->json(array(
                        'ok' => false,
                        'error' => 'Page deletion is not available through Bludit Wizard. Use the Bludit admin Content screen.',
                        'code' => 'deletion_not_supported'
                    ), 403);
                    break;

                case 'discover_models':
                    $this->handleDiscoverModels();
                    break;

                case 'test_model':
                    $this->handleTestModel();
                    break;

                default:
                    $this->json(array('ok' => false, 'error' => 'Unknown action.'), 400);
            }
        }
    }

    private function getDefaultSystemPrompt()
    {
        return 'You are Bludit Wizard, a careful CMS assistant. Prefer minimal, reversible changes. Never invent site facts. Return concise, production-ready content.';
    }

    /**
     * The twelve approved v1.1.0 tasks. Labels, categories and action labels are
     * fixed by the specification and verified by tests.
     */
    private function taskDefinitions()
    {
        return array(
            // Category A — Write & Create
            'create_page' => array(
                'label' => 'Create a new page',
                'category' => 'Write & Create',
                'action' => 'Generate Draft',
                'page' => 'none',
                'result' => 'page_draft',
                'editable' => true,
                'promptRequired' => true,
                'promptLabel' => 'What should the page be about?',
                'placeholder' => 'Example: A practical guide to brewing loose-leaf tea at home.',
                'guidance' => 'Drafts a new Bludit page from your instructions. No existing page is used. You can edit the draft and must approve it before it is created.',
                'options' => array()
            ),
            'create_outline' => array(
                'label' => 'Create an outline',
                'category' => 'Write & Create',
                'action' => 'Generate Outline',
                'page' => 'none',
                'result' => 'text_generation',
                'editable' => false,
                'promptRequired' => true,
                'promptLabel' => 'What is the topic?',
                'placeholder' => 'Example: A beginner’s guide to keeping a sourdough starter.',
                'guidance' => 'Generates a structured article or page outline from the topic you supply. It does not use an existing page and never creates one. The result is text you can copy.',
                'options' => array()
            ),
            'article_ideas' => array(
                'label' => 'Generate article ideas',
                'category' => 'Write & Create',
                'action' => 'Generate Ideas',
                'page' => 'none',
                'result' => 'text_generation',
                'editable' => false,
                'promptRequired' => true,
                'promptLabel' => 'What should the ideas be about?',
                'placeholder' => 'Example: Topics for a personal blog about urban gardening.',
                'guidance' => 'Suggests article topics with a suggested angle and short description. It uses only your instructions and the site’s page titles, and never creates pages.',
                'options' => array()
            ),
            // Category B — Edit & Improve
            'improve_page' => array(
                'label' => 'Improve an existing page',
                'category' => 'Edit & Improve',
                'action' => 'Review Improvements',
                'page' => 'required',
                'result' => 'page_revision',
                'editable' => true,
                'promptRequired' => true,
                'promptLabel' => 'What should be improved?',
                'placeholder' => 'Example: Make this clearer and more persuasive without changing the facts.',
                'guidance' => 'Reviews an existing page you select and proposes an improved revision. The original is shown read-only beside the proposal; nothing is written until you approve it.',
                'options' => array()
            ),
            'rewrite_tone' => array(
                'label' => 'Rewrite tone or style',
                'category' => 'Edit & Improve',
                'action' => 'Rewrite Content',
                'page' => 'required',
                'result' => 'page_revision',
                'editable' => true,
                'promptRequired' => false,
                'promptLabel' => 'Any additional instructions? (optional)',
                'placeholder' => 'Example: Keep the examples, but make it more concise.',
                'guidance' => 'Rewrites the selected page in the tone or style you choose while preserving its meaning. You review the original beside the proposal before applying.',
                'options' => array('tone')
            ),
            'adjust_length' => array(
                'label' => 'Expand or shorten content',
                'category' => 'Edit & Improve',
                'action' => 'Adjust Length',
                'page' => 'required',
                'result' => 'page_revision',
                'editable' => true,
                'promptRequired' => false,
                'promptLabel' => 'Length or detail instructions (optional)',
                'placeholder' => 'Example: Aim for about 600 words and keep the existing structure.',
                'guidance' => 'Expands or condenses the selected page. It will not invent unsupported facts. You compare the original with the proposal and must approve any write.',
                'options' => array('length')
            ),
            'proofread' => array(
                'label' => 'Proofread content',
                'category' => 'Edit & Improve',
                'action' => 'Proofread Page',
                'page' => 'required',
                'result' => 'page_revision',
                'editable' => true,
                'promptRequired' => false,
                'promptLabel' => 'Focus for the proofread (optional)',
                'placeholder' => 'Example: Pay attention to punctuation and repeated words.',
                'guidance' => 'Corrects spelling, punctuation, grammar and obvious clarity issues in the selected page while preserving your voice. You review the changes before applying.',
                'options' => array()
            ),
            // Category C — SEO & Quality
            'seo_audit' => array(
                'label' => 'SEO + clarity audit',
                'category' => 'SEO & Quality',
                'action' => 'Analyze Page',
                'page' => 'required',
                'result' => 'structured_audit',
                'editable' => false,
                'promptRequired' => false,
                'promptLabel' => 'Focus areas (optional)',
                'placeholder' => 'Example: Focus on the introduction and the headings.',
                'guidance' => 'Reviews the selected page and returns a read-only report with findings, priorities and recommendations. It never modifies the page and does not invent ranking or traffic data.',
                'options' => array()
            ),
            'seo_metadata' => array(
                'label' => 'Generate SEO metadata',
                'category' => 'SEO & Quality',
                'action' => 'Generate Metadata',
                'page' => 'required',
                'result' => 'metadata_proposal',
                'editable' => true,
                'promptRequired' => false,
                'promptLabel' => 'Metadata guidance (optional)',
                'placeholder' => 'Example: Emphasise the practical benefits.',
                'guidance' => 'Suggests a page title, description and slug supported by Bludit. You review them before applying; content is left unchanged.',
                'options' => array()
            ),
            'internal_links' => array(
                'label' => 'Suggest internal links',
                'category' => 'SEO & Quality',
                'action' => 'Find Link Opportunities',
                'page' => 'required',
                'result' => 'structured_audit',
                'editable' => false,
                'promptRequired' => false,
                'promptLabel' => 'Link focus (optional)',
                'placeholder' => 'Example: Prefer links to the beginner guides.',
                'guidance' => 'Suggests internal links from the selected page to pages that actually exist. Target pages are validated; nothing is inserted and the page is not changed.',
                'options' => array()
            ),
            'freshness_audit' => array(
                'label' => 'Audit content freshness',
                'category' => 'SEO & Quality',
                'action' => 'Check Content Freshness',
                'page' => 'required',
                'result' => 'structured_audit',
                'editable' => false,
                'promptRequired' => false,
                'promptLabel' => 'What should be checked? (optional)',
                'placeholder' => 'Example: Check dates, product names and prices.',
                'guidance' => 'Identifies content that may be outdated and needs verification. It distinguishes suspected staleness from confirmed errors and never modifies the page.',
                'options' => array()
            ),
            // Category D — General
            'ask_wizard' => array(
                'label' => 'Ask Wizard',
                'category' => 'General',
                'action' => 'Ask Wizard',
                'page' => 'optional',
                'result' => 'conversational',
                'editable' => false,
                'promptRequired' => true,
                'promptLabel' => 'Your question',
                'placeholder' => 'Example: How should I structure a series of posts about tea?',
                'guidance' => 'Answers a question about writing, your site or supported Bludit features. Page content is included only if you explicitly select a page. It never changes the site.',
                'options' => array()
            )
        );
    }

    private function handleAi()
    {
        $tasks = $this->taskDefinitions();
        $task = isset($_POST['task']) ? Sanitize::html($_POST['task']) : '';
        if (!isset($tasks[$task])) {
            $this->json(array('ok' => false, 'error' => 'Unknown task.'), 400);
        }
        $def = $tasks[$task];

        $prompt = isset($_POST['prompt']) ? trim((string)$_POST['prompt']) : '';
        $pageKey = isset($_POST['pageKey']) ? trim((string)$_POST['pageKey']) : '';
        $tone = isset($_POST['tone']) ? trim((string)$_POST['tone']) : '';
        $lengthMode = isset($_POST['lengthMode']) ? strtolower(trim((string)$_POST['lengthMode'])) : '';
        $lengthNotes = isset($_POST['lengthNotes']) ? trim((string)$_POST['lengthNotes']) : '';

        // Context isolation: tasks that take no page ignore any page key.
        if ($def['page'] === 'none') {
            $pageKey = '';
        }

        $original = null;
        $selectedPage = null;
        if ($pageKey !== '') {
            global $pages;
            if (!$pages->exists($pageKey)) {
                $this->json(array('ok' => false, 'error' => 'Selected page does not exist.'), 404);
            }
            $page = buildPage($pageKey);
            if (!$page) {
                $this->json(array('ok' => false, 'error' => 'Selected page could not be loaded.'), 500);
            }
            $original = $this->pageReviewSnapshot($page, $pageKey);
            $selectedPage = array(
                'key' => $pageKey,
                'title' => $page->title(),
                'description' => $page->description(),
                'type' => $page->type(),
                'content' => mb_substr((string)$original['content'], 0, 20000)
            );
        }

        if ($def['page'] === 'required' && $pageKey === '') {
            $this->json(array('ok' => false, 'error' => 'Select a page for this task.'), 400);
        }
        if ($def['promptRequired'] && $prompt === '') {
            $this->json(array('ok' => false, 'error' => 'Please enter an instruction.'), 400);
        }
        if ($task === 'rewrite_tone' && $tone === '') {
            $this->json(array('ok' => false, 'error' => 'Choose a target tone or style.'), 400);
        }
        if ($task === 'adjust_length' && !in_array($lengthMode, array('expand', 'shorten'), true)) {
            $this->json(array('ok' => false, 'error' => 'Choose whether to expand or shorten the content.'), 400);
        }

        $request = $this->buildTaskRequest($task, $def, $prompt, $selectedPage, $tone, $lengthMode, $lengthNotes);
        $response = $this->callProvider($request);
        if (!$response['ok']) {
            $this->json(array('ok' => false, 'error' => $response['error']), 500);
        }

        $content = $response['content'];
        $data = null;

        // Internal link suggestions are validated against the real page index.
        if ($task === 'internal_links') {
            $parsed = $this->parseJsonResult($content);
            if ($parsed === null || !isset($parsed['links']) || !is_array($parsed['links'])) {
                $this->json(array('ok' => false, 'error' => 'The AI returned an unexpected format for link suggestions. Please try again.'), 502);
            }
            $links = array();
            foreach ($parsed['links'] as $link) {
                if (!is_array($link)) {
                    continue;
                }
                $target = isset($link['target']) ? trim((string)$link['target']) : '';
                $exists = ($target !== '' && $pages->exists($target));
                $links[] = array(
                    'source_text' => isset($link['source_text']) ? (string)$link['source_text'] : '',
                    'target' => $target,
                    'reason' => isset($link['reason']) ? (string)$link['reason'] : '',
                    'valid' => $exists,
                    'url' => $exists ? buildPage($target)->permalink() : ''
                );
            }
            $data = array('links' => $links);
        }

        $this->json(array(
            'ok' => true,
            'task' => $task,
            'resultType' => $def['result'],
            'editable' => (bool)$def['editable'],
            'result' => $content,
            'original' => $original,
            'data' => $data
        ));
    }

    private function parseJsonResult($content)
    {
        $cleaned = preg_replace('/^```json\s*/i', '', trim((string)$content));
        $cleaned = preg_replace('/\s*```$/', '', $cleaned);
        $decoded = json_decode($cleaned, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function buildTaskRequest($task, $def, $prompt, $selectedPage, $tone, $lengthMode, $lengthNotes)
    {
        $instructions = $this->taskInstructions($task, $tone, $lengthMode, $lengthNotes);
        $context = $this->getTaskContext($task);

        $payload = array(
            'Task' => $def['label'],
            'User instruction' => $prompt,
            'Selected page' => $selectedPage,
            'Site context' => $context
        );
        if ($tone !== '') {
            $payload['Target tone or style'] = $tone;
        }
        if ($lengthMode !== '') {
            $payload['Length mode'] = $lengthMode;
        }
        if ($lengthNotes !== '') {
            $payload['Length instructions'] = $lengthNotes;
        }

        $messages = array(
            array('role' => 'system', 'content' => $this->getValue('systemPrompt')),
            array('role' => 'system', 'content' => $instructions),
            array('role' => 'user', 'content' => json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))
        );

        return array(
            'model' => $this->getValue('model'),
            'messages' => $messages,
            'temperature' => (float)$this->getValue('temperature'),
            'max_tokens' => (int)$this->getValue('maxTokens')
        );
    }

    private function taskInstructions($task, $tone, $lengthMode, $lengthNotes)
    {
        switch ($task) {
            case 'create_page':
                return 'Create a new Bludit page from the user instruction. Return ONLY valid JSON with keys title, slug, description, type, content, tags. type must be one of: draft, published, static, sticky, scheduled. Default to draft unless the user explicitly asked for another status. Content must be complete Markdown suitable for Bludit. Do not use fenced code blocks. Do not invent facts.';
            case 'create_outline':
                return 'Produce a structured article or page outline from the topic in the user instruction. Return readable Markdown with headings and bullet points. Do not create or modify any Bludit page.';
            case 'article_ideas':
                return 'Suggest 5 to 8 actionable article ideas based on the user instruction and the provided page titles. For each idea give a short suggested angle and a one-sentence description. Return readable Markdown. Do not create pages.';
            case 'improve_page':
                return 'Improve the selected page while preserving its intent and important facts. Return ONLY valid JSON with keys title, description, content. Content must be complete, not a fragment. Do not use fenced code blocks.';
            case 'rewrite_tone':
                return 'Rewrite the selected page in this target tone or style: ' . $tone . '. Preserve factual meaning and important details. Return ONLY valid JSON with keys title, description, content.';
            case 'adjust_length':
                $mode = ($lengthMode === 'shorten') ? 'Shorten/condense' : 'Expand';
                return $mode . ' the selected page. ' . ($lengthNotes !== '' ? ('Additional instructions: ' . $lengthNotes . '. ') : '') . 'Preserve core meaning and do not add unsupported facts. Return ONLY valid JSON with keys title, description, content.';
            case 'proofread':
                return 'Proofread the selected page. Correct spelling, punctuation, grammar and obvious clarity issues. Preserve the author voice and avoid unnecessary rewrites. Return ONLY valid JSON with keys title, description, content.';
            case 'seo_audit':
                return 'Perform a READ-ONLY SEO and clarity audit of the selected page. Return readable Markdown with sections: Findings, Priorities, Recommendations. Examine the title, headings, description, structure and readability. Recommend internal links only to pages in the provided site context. Never invent rankings, keyword volumes, backlinks or crawl data. Do not return replacement content and do not modify the page.';
            case 'seo_metadata':
                return 'Suggest SEO metadata supported by Bludit for the selected page. Bludit supports the page title, description and slug (not arbitrary meta tags). Return ONLY valid JSON with keys title, description, slug. Do not invent unsupported fields. Do not change the page content.';
            case 'internal_links':
                return 'Suggest internal links from the selected page to pages that exist in the provided site context. Return ONLY valid JSON: {"links":[{"source_text":"...","target":"<page key>","reason":"..."}]}. Use only page keys from the provided list. Do not invent pages. Do not modify any content.';
            case 'freshness_audit':
                return 'Audit the selected page for potentially outdated content (dates, references, facts that may need verification). Return readable Markdown with sections: Suspected staleness, Needs verification, Recommended next steps. Clearly distinguish suspected staleness from confirmed inaccuracies. Do not claim to have verified external facts. Do not modify the page.';
            case 'ask_wizard':
                return 'Answer the user question about writing, publishing or supported Bludit features. Return concise, readable Markdown. Do not claim to have changed the site.';
            default:
                return 'Answer concisely and do not modify the site.';
        }
    }

    private function getTaskContext($task)
    {
        global $site, $pages;
        $context = array(
            'site' => array(
                'title' => $site->title(),
                'description' => $site->description(),
                'url' => $site->url()
            )
        );

        // Only expose the page index where the task genuinely needs it.
        $needsPageIndex = in_array($task, array('article_ideas', 'seo_audit', 'internal_links', 'freshness_audit'), true);
        if ($needsPageIndex) {
            $list = array();
            foreach ($pages->getDB(true) as $key) {
                $page = buildPage($key);
                if (!$page) {
                    continue;
                }
                $list[] = array(
                    'key' => $key,
                    'title' => $page->title(),
                    'type' => $page->type(),
                    'url' => $page->permalink()
                );
                if (count($list) >= 200) {
                    break;
                }
            }
            $context['pages'] = $list;
        }

        return $context;
    }

    private function callProvider($payload)
    {
        $baseUrl = trim((string)$this->getValue('baseUrl'));
        $apiKey = (string)$this->getValue('apiKey');

        if ($baseUrl === '') {
            return array('ok' => false, 'error' => 'AI base URL is not configured.');
        }

        $url = $this->validateProviderUrl($baseUrl);
        if (!$url['valid']) {
            return array('ok' => false, 'error' => 'AI base URL is not allowed: ' . $url['reason']);
        }

        $pin = $this->prepareHostPinning($url);
        if (!$pin['ok']) {
            return array('ok' => false, 'error' => 'AI request refused: ' . $pin['reason']);
        }

        $endpoint = rtrim($url['normalized'], '/') . '/chat/completions';
        $headers = array(
            'Content-Type: application/json',
            'Accept: application/json'
        );
        if ($apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $apiKey;
        }

        $response = $this->httpJson('POST', $endpoint, $headers, json_encode($payload), 15, 90, 8 * 1024 * 1024, $pin);
        if (!$response['transportOk']) {
            return array('ok' => false, 'error' => 'AI request failed: ' . $response['error']);
        }

        $data = $response['json'];
        if ($response['status'] < 200 || $response['status'] >= 300) {
            $message = $this->providerErrorMessage($data, $response['body']);
            if ($message === '') {
                $message = 'Provider returned HTTP ' . $response['status'] . '.';
            }
            return array('ok' => false, 'error' => $message);
        }

        $content = '';
        if (isset($data['choices'][0]['message']['content'])) {
            $content = (string)$data['choices'][0]['message']['content'];
        }

        if ($content === '') {
            return array('ok' => false, 'error' => 'Provider returned no assistant content.');
        }

        return array(
            'ok' => true,
            'content' => trim($content)
        );
    }

    /* ------------------------------------------------------------------ */
    /* Provider presets, validation, model discovery and inference test   */
    /* ------------------------------------------------------------------ */

    private function requireAdministrator()
    {
        global $login;
        $isAdmin = isset($login) && is_object($login)
            && method_exists($login, 'isLogged') && $login->isLogged()
            && method_exists($login, 'role') && $login->role() === 'admin';
        if (!$isAdmin) {
            $this->json(array('ok' => false, 'error' => 'Administrator access is required for provider operations.'), 403);
        }
    }

    /**
     * Whether the AI provider may live on a private/internal network. Off by
     * default; loopback (Ollama on 127.0.0.1) is always permitted without this.
     */
    private function isPrivateProviderAllowed()
    {
        $value = $this->getValue('allowPrivateProviders');
        return ($value === true || $value === 'true' || $value === '1' || $value === 1);
    }

    private function providerPresets()
    {
        return array(
            'openai' => array('label' => 'OpenAI', 'baseUrl' => 'https://api.openai.com/v1'),
            'openrouter' => array('label' => 'OpenRouter', 'baseUrl' => 'https://openrouter.ai/api/v1'),
            'llmgateway' => array('label' => 'LLM Gateway', 'baseUrl' => 'https://api.llmgateway.io/v1'),
            'ollama' => array('label' => 'Ollama (local)', 'baseUrl' => 'http://127.0.0.1:11434/v1'),
            'compatible' => array('label' => 'Custom OpenAI-compatible', 'baseUrl' => '')
        );
    }

    private function modelsCacheFile()
    {
        $base = defined('PATH_WORKSPACES') ? PATH_WORKSPACES : '';
        $dir = $base . 'wizard' . DIRECTORY_SEPARATOR;
        if ($base !== '' && !is_dir($dir)) {
            $permissions = defined('DIR_PERMISSIONS') ? DIR_PERMISSIONS : 0755;
            @mkdir($dir, $permissions, true);
        }
        return $dir . 'models.php';
    }

    private function readModelsCache()
    {
        $file = $this->modelsCacheFile();
        if (!is_file($file)) {
            return null;
        }
        $lines = file($file, FILE_IGNORE_NEW_LINES);
        if ($lines === false || count($lines) < 2) {
            return null;
        }
        array_shift($lines); // Discard the "defined('BLUDIT')" guard line.
        $decoded = json_decode(implode('', $lines), true);
        return is_array($decoded) ? $decoded : null;
    }

    private function writeModelsCache($data)
    {
        $file = $this->modelsCacheFile();
        $payload = "<?php defined('BLUDIT') or die('Bludit CMS.'); ?>" . PHP_EOL
            . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return @file_put_contents($file, $payload, LOCK_EX) !== false;
    }

    private function getModelsCacheForForm()
    {
        $empty = array(
            'models' => array(),
            'hasPricing' => false,
            'hasTools' => false,
            'count' => 0,
            'fetchedAt' => 0,
            'stale' => true
        );

        $cache = $this->readModelsCache();
        $baseUrl = trim((string)$this->getValue('baseUrl'));
        if (!is_array($cache) || !isset($cache['baseUrl']) || (string)$cache['baseUrl'] !== $baseUrl) {
            return $empty;
        }

        $models = (isset($cache['models']) && is_array($cache['models'])) ? $cache['models'] : array();
        return array(
            'models' => $models,
            'hasPricing' => !empty($cache['hasPricing']),
            'hasTools' => !empty($cache['hasTools']),
            'count' => count($models),
            'fetchedAt' => isset($cache['fetchedAt']) ? (int)$cache['fetchedAt'] : 0,
            'stale' => false
        );
    }

    private function handleDiscoverModels()
    {
        $this->requireAdministrator();

        $baseUrl = isset($_POST['baseUrl']) ? trim((string)$_POST['baseUrl']) : '';
        $apiKey = isset($_POST['apiKey']) ? (string)$_POST['apiKey'] : '';
        if ($baseUrl === '') {
            $baseUrl = trim((string)$this->getValue('baseUrl'));
        }
        if ($apiKey === '') {
            $apiKey = (string)$this->getValue('apiKey');
        }

        $result = $this->discoverModels($baseUrl, $apiKey);

        // Only a successfully retrieved catalog is cached. Discovery never
        // writes plugin settings, so the configured model is never cleared.
        if (!empty($result['stages']['catalog']['retrieved'])) {
            $this->writeModelsCache(array(
                'baseUrl' => $baseUrl,
                'provider' => (string)$this->getValue('provider'),
                'fetchedAt' => time(),
                'models' => $result['models'],
                'hasPricing' => !empty($result['filters']['hasPricing']),
                'hasTools' => !empty($result['filters']['hasTools'])
            ));
        }

        $this->json($result);
    }

    private function discoverModels($baseUrl, $apiKey)
    {
        $url = $this->validateProviderUrl($baseUrl);
        $stages = array(
            'url' => array('valid' => $url['valid'], 'https' => $url['https'], 'host' => $url['host'], 'reason' => $url['reason']),
            'network' => array('reachable' => false, 'status' => 0, 'error' => ''),
            'auth' => array('attempted' => ($apiKey !== ''), 'ok' => null),
            'catalog' => array('retrieved' => false, 'count' => 0, 'format' => '', 'error' => '')
        );
        $models = array();
        $filters = array('hasPricing' => false, 'hasTools' => false);

        if (!$url['valid']) {
            return array('ok' => false, 'stages' => $stages, 'models' => $models, 'filters' => $filters, 'error' => $url['reason']);
        }

        // Resolve and pin the provider host before any connection is opened.
        $pin = $this->prepareHostPinning($url);
        if (!$pin['ok']) {
            $stages['network']['error'] = $pin['reason'];
            return array('ok' => false, 'stages' => $stages, 'models' => $models, 'filters' => $filters, 'error' => $pin['reason']);
        }

        $endpoint = rtrim($url['normalized'], '/') . '/models';
        $headers = array('Accept: application/json');
        if ($apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $apiKey;
        }

        $response = $this->httpJson('GET', $endpoint, $headers, null, 10, 20, 4 * 1024 * 1024, $pin);
        if (!$response['transportOk']) {
            $stages['network']['error'] = $response['error'];
            return array('ok' => false, 'stages' => $stages, 'models' => $models, 'filters' => $filters, 'error' => 'Could not reach the provider: ' . $response['error']);
        }

        $stages['network']['reachable'] = true;
        $stages['network']['status'] = $response['status'];

        $parsed = $this->parseModelList($response['body'], $response['json']);
        $stages['catalog']['format'] = $parsed['format'];

        if ($response['status'] === 200) {
            $stages['auth']['ok'] = ($apiKey !== '') ? true : null;
            if ($parsed['retrieved']) {
                $stages['catalog']['retrieved'] = true;
                $stages['catalog']['count'] = count($parsed['models']);
                $models = $parsed['models'];
                $filters = $parsed['filters'];
            } else {
                $stages['catalog']['error'] = $parsed['error'];
            }
        } elseif ($response['status'] === 401 || $response['status'] === 403) {
            $stages['auth']['ok'] = false;
        }

        $ok = !empty($stages['catalog']['retrieved']);
        $error = '';
        if (!$ok) {
            if ($stages['auth']['ok'] === false) {
                $error = 'The provider rejected the API key (HTTP ' . $response['status'] . ').';
            } elseif ($response['status'] !== 200) {
                $error = 'The provider returned HTTP ' . $response['status'] . ' for /models.';
            } elseif ($parsed['error'] !== '') {
                $error = $parsed['error'];
            } else {
                $error = 'The /models response was not a recognized model list.';
            }
        }

        return array('ok' => $ok, 'stages' => $stages, 'models' => $models, 'filters' => $filters, 'error' => $error);
    }

    private function handleTestModel()
    {
        $this->requireAdministrator();

        $baseUrl = isset($_POST['baseUrl']) ? trim((string)$_POST['baseUrl']) : '';
        $apiKey = isset($_POST['apiKey']) ? (string)$_POST['apiKey'] : '';
        $model = isset($_POST['model']) ? trim((string)$_POST['model']) : '';
        if ($baseUrl === '') {
            $baseUrl = trim((string)$this->getValue('baseUrl'));
        }
        if ($apiKey === '') {
            $apiKey = (string)$this->getValue('apiKey');
        }
        if ($model === '') {
            $model = trim((string)$this->getValue('model'));
        }

        $this->json($this->testModel($baseUrl, $apiKey, $model));
    }

    private function testModel($baseUrl, $apiKey, $model)
    {
        $url = $this->validateProviderUrl($baseUrl);
        $model = trim((string)$model);
        $stages = array(
            'url' => array('valid' => $url['valid'], 'https' => $url['https'], 'host' => $url['host'], 'reason' => $url['reason']),
            'network' => array('reachable' => false, 'status' => 0, 'error' => ''),
            'auth' => array('attempted' => ($apiKey !== ''), 'ok' => null),
            'inference' => array('ok' => null, 'status' => 0, 'model' => $model, 'error' => '')
        );

        if ($model === '') {
            $stages['inference']['error'] = 'No model selected.';
            return array('ok' => false, 'stages' => $stages, 'error' => 'No model selected.');
        }
        if (!$url['valid']) {
            return array('ok' => false, 'stages' => $stages, 'error' => $url['reason']);
        }

        $pin = $this->prepareHostPinning($url);
        if (!$pin['ok']) {
            $stages['network']['error'] = $pin['reason'];
            return array('ok' => false, 'stages' => $stages, 'error' => $pin['reason']);
        }

        $endpoint = rtrim($url['normalized'], '/') . '/chat/completions';
        $headers = array('Content-Type: application/json', 'Accept: application/json');
        if ($apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $apiKey;
        }
        $payload = json_encode(array(
            'model' => $model,
            'messages' => array(array('role' => 'user', 'content' => 'ping')),
            'max_tokens' => 1,
            'temperature' => 0
        ));

        $response = $this->httpJson('POST', $endpoint, $headers, $payload, 10, 30, 1024 * 1024, $pin);
        if (!$response['transportOk']) {
            $stages['network']['error'] = $response['error'];
            return array('ok' => false, 'stages' => $stages, 'error' => 'Could not reach the provider: ' . $response['error']);
        }

        $stages['network']['reachable'] = true;
        $stages['network']['status'] = $response['status'];
        $error = '';

        if ($response['status'] === 200) {
            $stages['auth']['ok'] = ($apiKey !== '') ? true : null;
            $hasChoice = is_array($response['json']) && isset($response['json']['choices'][0]);
            $stages['inference']['ok'] = $hasChoice;
            $stages['inference']['status'] = 200;
            if (!$hasChoice) {
                $stages['inference']['error'] = 'The provider answered but returned no completion choices.';
                $error = $stages['inference']['error'];
            }
        } elseif ($response['status'] === 401 || $response['status'] === 403) {
            $stages['auth']['ok'] = false;
            $stages['inference']['ok'] = false;
            $stages['inference']['status'] = $response['status'];
            $error = 'Authentication failed (HTTP ' . $response['status'] . '). The model was not exercised.';
            $stages['inference']['error'] = $error;
        } else {
            $stages['inference']['ok'] = false;
            $stages['inference']['status'] = $response['status'];
            $message = $this->providerErrorMessage($response['json'], $response['body']);
            $error = 'The provider returned HTTP ' . $response['status'] . ($message !== '' ? ': ' . $message : '');
            $stages['inference']['error'] = $error;
        }

        return array('ok' => ($stages['inference']['ok'] === true), 'stages' => $stages, 'error' => $error);
    }

    /**
     * Parse an OpenAI-style model catalog into a normalized list.
     *
     * Understands `data[].id` (OpenAI/OpenRouter/LLM Gateway), optional display
     * names, OpenRouter-style `pricing`/`supported_parameters`, and generic
     * `capabilities`/`features`/`cost` shapes. Capability and pricing metadata
     * are only reported when actually present, so the UI can hide filters that
     * cannot be trusted.
     */
    private function parseModelList($body, $json)
    {
        $out = array(
            'retrieved' => false,
            'models' => array(),
            'filters' => array('hasPricing' => false, 'hasTools' => false),
            'format' => '',
            'error' => ''
        );

        if (!is_array($json)) {
            $out['format'] = 'invalid-json';
            $out['error'] = 'The /models response was not valid JSON.';
            return $out;
        }

        $list = null;
        if (isset($json['data']) && is_array($json['data'])) {
            $list = $json['data'];
            $out['format'] = 'openai.data';
        } elseif (isset($json['models']) && is_array($json['models'])) {
            $list = $json['models'];
            $out['format'] = 'models';
        } elseif (isset($json['result']) && is_array($json['result'])) {
            $list = $json['result'];
            $out['format'] = 'result';
        } elseif (isset($json[0])) {
            $list = $json;
            $out['format'] = 'array';
        }

        if ($list === null) {
            $out['error'] = 'No model array was found in the response.';
            return $out;
        }

        $models = array();
        $hasPricing = false;
        $hasTools = false;

        foreach ($list as $entry) {
            if (is_string($entry)) {
                $models[] = array('id' => $entry, 'name' => $entry, 'free' => null, 'tools' => null, 'context' => null, 'prompt' => null, 'completion' => null);
                continue;
            }
            if (!is_array($entry)) {
                continue;
            }

            $id = '';
            foreach (array('id', 'model', 'name', 'slug') as $key) {
                if (isset($entry[$key]) && is_string($entry[$key]) && $entry[$key] !== '') {
                    $id = $entry[$key];
                    break;
                }
            }
            if ($id === '') {
                continue;
            }
            $name = (isset($entry['name']) && is_string($entry['name']) && $entry['name'] !== '') ? $entry['name'] : $id;

            $prompt = null;
            $completion = null;
            if (isset($entry['pricing']) && is_array($entry['pricing'])) {
                if (isset($entry['pricing']['prompt']) && is_numeric($entry['pricing']['prompt'])) {
                    $prompt = (float)$entry['pricing']['prompt'];
                }
                if (isset($entry['pricing']['completion']) && is_numeric($entry['pricing']['completion'])) {
                    $completion = (float)$entry['pricing']['completion'];
                }
            } elseif (isset($entry['cost']) && is_array($entry['cost'])) {
                if (isset($entry['cost']['input']) && is_numeric($entry['cost']['input'])) {
                    $prompt = (float)$entry['cost']['input'];
                }
                if (isset($entry['cost']['output']) && is_numeric($entry['cost']['output'])) {
                    $completion = (float)$entry['cost']['output'];
                }
            }
            $free = null;
            if ($prompt !== null || $completion !== null) {
                $free = (($prompt === null || $prompt == 0.0) && ($completion === null || $completion == 0.0));
                $hasPricing = true;
            }

            $tools = null;
            if (isset($entry['supported_parameters']) && is_array($entry['supported_parameters'])) {
                $params = array_map('strtolower', array_map('strval', $entry['supported_parameters']));
                $tools = in_array('tools', $params, true) || in_array('tool_choice', $params, true) || in_array('function_calling', $params, true);
                $hasTools = true;
            } elseif (isset($entry['capabilities']) && is_array($entry['capabilities']) && array_key_exists('tools', $entry['capabilities'])) {
                $tools = (bool)$entry['capabilities']['tools'];
                $hasTools = true;
            } elseif (isset($entry['features']) && is_array($entry['features'])) {
                $features = array_map('strtolower', array_map('strval', $entry['features']));
                $tools = in_array('tools', $features, true) || in_array('function-calling', $features, true) || in_array('function_calling', $features, true);
                $hasTools = true;
            }

            $context = null;
            foreach (array('context_length', 'context_window', 'max_context_length', 'context') as $key) {
                if (isset($entry[$key]) && is_numeric($entry[$key])) {
                    $context = (int)$entry[$key];
                    break;
                }
            }

            $models[] = array(
                'id' => $id,
                'name' => $name,
                'free' => $free,
                'tools' => $tools,
                'context' => $context,
                'prompt' => $prompt,
                'completion' => $completion
            );
        }

        $out['retrieved'] = true;
        $out['models'] = $models;
        $out['filters']['hasPricing'] = $hasPricing;
        $out['filters']['hasTools'] = $hasTools;
        return $out;
    }

    /**
     * Validate a provider base URL against the SSRF policy.
     *
     * Performs no network I/O. The policy and address classification live in
     * wizard/lib/netpolicy.php so they can be unit-tested in isolation.
     */
    private function validateProviderUrl($url)
    {
        $this->policy();
        return BluditWizardNetPolicy::validateProviderUrl($url, $this->isPrivateProviderAllowed());
    }

    private function classifyProviderHost($host)
    {
        $this->policy();
        return BluditWizardNetPolicy::classifyHost($host);
    }

    private function isBlockedIpLiteral($ip)
    {
        $this->policy();
        return (BluditWizardNetPolicy::classifyIp($ip) === 'blocked');
    }

    private function isLoopbackIp($ip)
    {
        $this->policy();
        return (BluditWizardNetPolicy::classifyIp($ip) === 'loopback');
    }

    private function isPrivateIp($ip)
    {
        $this->policy();
        return (BluditWizardNetPolicy::classifyIp($ip) === 'private');
    }

    /**
     * Resolve a provider hostname and pin the connection to verified addresses.
     *
     * Security properties:
     *   - IP literals (including numeric encodings) are re-screened and used
     *     directly; they cannot be rebound.
     *   - Hostnames FAIL CLOSED unless CURLOPT_RESOLVE is available: an unpinned
     *     connection is never made.
     *   - Every resolved address must pass the policy (blocked/metadata always
     *     refused; private unless opted in; loopback allowed).
     *   - The hostname is bound to the verified addresses so the resolver cannot
     *     be consulted again mid-flight, and the transport additionally verifies
     *     the address actually connected to.
     *
     * Returns array('ok' => bool, 'reason' => string, 'entries' => string[], 'ips' => string[]).
     */
    private function prepareHostPinning($url)
    {
        $this->policy();
        $host = isset($url['host']) ? (string)$url['host'] : '';
        if ($host === '') {
            return array('ok' => false, 'reason' => 'The provider host is missing.', 'entries' => array(), 'ips' => array());
        }

        $privateAllowed = $this->isPrivateProviderAllowed();
        $port = (!empty($url['port'])) ? (int)$url['port'] : (!empty($url['https']) ? 443 : 80);

        // IP literals and numeric encodings need no resolution.
        $literal = BluditWizardNetPolicy::hostToIpLiteral($host);
        if ($literal !== null) {
            $screened = BluditWizardNetPolicy::screenIps(array($literal), $privateAllowed);
            if (!$screened['ok']) {
                return array('ok' => false, 'reason' => $screened['reason'], 'entries' => array(), 'ips' => array());
            }
            return array('ok' => true, 'reason' => '', 'entries' => array(), 'ips' => $screened['allowed']);
        }

        // Hostnames: never fall back to an unpinned connection.
        if (!defined('CURLOPT_RESOLVE')) {
            return array(
                'ok' => false,
                'reason' => 'Secure hostname pinning is not available in this PHP cURL build (CURLOPT_RESOLVE is missing). Refusing to send the request rather than risk an unpinned connection.',
                'entries' => array(),
                'ips' => array()
            );
        }

        $resolved = $this->resolveHostIps($host);
        if (!$resolved['ok']) {
            return array('ok' => false, 'reason' => $resolved['error'], 'entries' => array(), 'ips' => array());
        }

        $pinned = BluditWizardNetPolicy::resolveEntries($host, $port, $resolved['ips'], true, $privateAllowed);
        if (!$pinned['ok']) {
            return array('ok' => false, 'reason' => $pinned['reason'], 'entries' => array(), 'ips' => array());
        }

        return array('ok' => true, 'reason' => '', 'entries' => $pinned['entries'], 'ips' => $pinned['ips']);
    }

    /**
     * Resolve a hostname to IPv4 and IPv6 addresses.
     *
     * Delegates to the bounded UDP DNS client in wizard/lib/netpolicy.php,
     * which imposes a wall-clock deadline (stream_select) instead of relying on
     * PHP's blocking resolver functions (gethostbynamel / dns_get_record) that
     * cannot be interrupted and have no per-call timeout.
     *
     * Returns array('ok' => bool, 'ips' => string[], 'error' => string).
     */
    private function resolveHostIps($host)
    {
        $budget = defined('BLUDIT_WIZARD_DNS_TIMEOUT') ? max(0.5, (float)BLUDIT_WIZARD_DNS_TIMEOUT) : 4.0;
        return BluditWizardNetPolicy::resolveHost($host, $this->dnsNameservers(), $budget);
    }

    /**
     * Read nameservers from the system resolver configuration.
     */
    private function dnsNameservers()
    {
        $servers = array();
        $file = '/etc/resolv.conf';
        if (is_readable($file)) {
            $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (is_array($lines)) {
                foreach ($lines as $line) {
                    $line = trim(preg_replace('/[#;].*$/', '', $line));
                    if (preg_match('/^\s*nameserver\s+(\S+)/i', $line, $m)) {
                        $ip = trim($m[1], '[]');
                        if (filter_var($ip, FILTER_VALIDATE_IP) !== false) {
                            $servers[$ip] = true;
                        }
                    }
                }
            }
        }
        return array_keys($servers);
    }
    /**
     * Partially mask an address before showing it to the operator.
     */
    private function maskIp($ip)
    {
        $this->policy();
        return BluditWizardNetPolicy::maskIp($ip);
    }

    /**
     * Minimal HTTP transport used for discovery, inference and AI calls.
     * Redirects are disabled (SSRF), the response size is capped, the connection
     * is pinned to the verified addresses, the address actually connected to is
     * verified, and returned error strings never contain request headers or the
     * API key.
     *
     * @param array $pin array('entries' => string[], 'ips' => string[])
     */
    private function httpJson($method, $url, $headers, $bodyString, $connectTimeout, $timeout, $maxBytes, $pin = array())
    {
        $this->policy();
        if (!function_exists('curl_init')) {
            return array('transportOk' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => 'PHP cURL is required.', 'errno' => 0);
        }

        $resolveEntries = (isset($pin['entries']) && is_array($pin['entries'])) ? $pin['entries'] : array();
        $expectedIps = (isset($pin['ips']) && is_array($pin['ips'])) ? $pin['ips'] : array();

        $body = '';
        $tooLarge = false;
        $ch = curl_init($url);
        $options = array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXREDIRS => 0,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_USERAGENT => 'BluditWizard/1.0.6',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS
        );
        if (defined('CURLOPT_REDIR_PROTOCOLS')) {
            $options[CURLOPT_REDIR_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
        }
        // Bind the hostname to the addresses verified by prepareHostPinning().
        if (!empty($resolveEntries) && defined('CURLOPT_RESOLVE')) {
            $options[CURLOPT_RESOLVE] = array_values($resolveEntries);
        }
        if (strtoupper($method) === 'POST') {
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = ($bodyString === null) ? '' : $bodyString;
        }
        $options[CURLOPT_WRITEFUNCTION] = function ($ch, $chunk) use (&$body, $maxBytes, &$tooLarge) {
            $body .= $chunk;
            if (strlen($body) > $maxBytes) {
                $tooLarge = true;
                return 0;
            }
            return strlen($chunk);
        };

        curl_setopt_array($ch, $options);
        curl_exec($ch);
        $errno = curl_errno($ch);
        $curlError = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $primaryIp = (string)curl_getinfo($ch, CURLINFO_PRIMARY_IP);
        curl_close($ch);

        if ($tooLarge) {
            return array('transportOk' => false, 'status' => $status, 'body' => '', 'json' => null, 'error' => 'The provider response exceeded the allowed size.', 'errno' => 0, 'tooLarge' => true);
        }
        if ($errno) {
            return array('transportOk' => false, 'status' => $status, 'body' => '', 'json' => null, 'error' => $this->safeCurlError($errno, $curlError), 'errno' => $errno);
        }

        // Connection-level enforcement: the peer address must be one the policy
        // verified. This catches any pin failure or resolver race.
        if (!empty($expectedIps) && $primaryIp !== '') {
            $primaryNorm = BluditWizardNetPolicy::normalizeIp($primaryIp);
            $matched = false;
            foreach ($expectedIps as $ip) {
                if (BluditWizardNetPolicy::normalizeIp($ip) === $primaryNorm) {
                    $matched = true;
                    break;
                }
            }
            if (!$matched) {
                return array(
                    'transportOk' => false,
                    'status' => $status,
                    'body' => '',
                    'json' => null,
                    'error' => 'The provider connection was not established to the verified address (possible DNS rebinding) and the response was discarded.',
                    'errno' => 0
                );
            }
        }

        return array(
            'transportOk' => true,
            'status' => $status,
            'body' => (string)$body,
            'json' => json_decode((string)$body, true),
            'error' => '',
            'errno' => 0
        );
    }

    private function providerErrorMessage($json, $body)
    {
        $message = '';
        if (is_array($json)) {
            if (isset($json['error']['message']) && is_string($json['error']['message'])) {
                $message = $json['error']['message'];
            } elseif (isset($json['error']) && is_string($json['error'])) {
                $message = $json['error'];
            } elseif (isset($json['message']) && is_string($json['message'])) {
                $message = $json['message'];
            }
        }
        return $this->sanitizeUpstreamMessage($message);
    }

    private function sanitizeUpstreamMessage($message)
    {
        $message = strip_tags((string)$message);
        $message = preg_replace('/[\x00-\x1F\x7F]+/', ' ', $message);
        $message = preg_replace('/\b(sk-[A-Za-z0-9_\-]{6,}|Bearer\s+[A-Za-z0-9._\-]{6,})/i', '[redacted]', $message);
        $message = trim($message);
        if (strlen($message) > 300) {
            $message = substr($message, 0, 300) . '...';
        }
        return $message;
    }

    private function safeCurlError($errno, $fallback)
    {
        switch ((int)$errno) {
            case 3:
                return 'The provider URL is malformed.';
            case 6:
                return 'Could not resolve the provider host.';
            case 7:
                return 'Could not connect to the provider.';
            case 23:
                return 'The provider response was too large.';
            case 28:
                return 'The provider did not respond in time.';
            case 35:
            case 51:
            case 58:
            case 60:
                return 'TLS verification with the provider failed.';
            default:
                return 'Network error (code ' . (int)$errno . ').';
        }
    }

    private function savePage()
    {
        global $pages;

        $key = isset($_POST['pageKey']) ? trim((string)$_POST['pageKey']) : '';
        $title = isset($_POST['title']) ? trim((string)$_POST['title']) : '';
        $description = isset($_POST['description']) ? trim((string)$_POST['description']) : '';
        $content = isset($_POST['content']) ? (string)$_POST['content'] : '';
        $type = isset($_POST['type']) ? trim((string)$_POST['type']) : '';
        $slug = isset($_POST['slug']) ? trim((string)$_POST['slug']) : '';
        $baseRevision = isset($_POST['baseRevision']) ? trim((string)$_POST['baseRevision']) : '';

        $allowedTypes = array('published', 'draft', 'static', 'sticky', 'scheduled');
        $typeValid = in_array($type, $allowedTypes, true);

        if ($title === '' || $content === '') {
            $this->json(array('ok' => false, 'error' => 'Title and content are required.'), 400);
        }

        if ($key !== '') {
            if (!$pages->exists($key)) {
                $this->json(array('ok' => false, 'error' => 'Page does not exist.'), 404);
            }

            // Stale-edit protection: re-read the saved page and refuse to write
            // if it changed since the review snapshot was taken.
            $current = buildPage($key);
            if (!$current) {
                $this->json(array('ok' => false, 'error' => 'Page could not be loaded.'), 500);
            }
            $currentRevision = $this->pageRevision($current);
            if ($baseRevision === '' || !hash_equals($currentRevision, $baseRevision)) {
                $this->json(array(
                    'ok' => false,
                    'code' => 'stale_page',
                    'error' => 'This page changed after it was loaded for review. Nothing was saved. Re-run the task to review the current version before applying changes.',
                    'revision' => $currentRevision
                ), 409);
            }

            // Never silently change publication status: if no valid type was
            // submitted, keep the page's existing type.
            if (!$typeValid) {
                $type = $current->type();
            }

            // Existing content is replaced only when the user explicitly submits
            // the Apply button in the Wizard. This is deliberate and visible.
            $newKey = editPage(array(
                'key' => $key,
                'title' => $title,
                'description' => $description,
                'content' => $content,
                'type' => $type,
                'slug' => $slug
            ));

            if ($newKey === false) {
                $this->json(array('ok' => false, 'error' => 'Bludit could not save the page.'), 500);
            }

            $verified = buildPage($newKey);
            $this->json(array(
                'ok' => true,
                'message' => 'Page updated and verified.',
                'page' => $this->pageSnapshot($verified, $newKey)
            ));
        }

        if (!$typeValid) {
            $type = 'draft';
        }

        $newKey = createPage(array(
            'title' => $title,
            'description' => $description,
            'content' => $content,
            'type' => $type,
            'slug' => $slug
        ));

        if ($newKey === false) {
            $this->json(array('ok' => false, 'error' => 'Bludit could not create the page.'), 500);
        }

        $verified = buildPage($newKey);
        $this->json(array(
            'ok' => true,
            'message' => 'Page created and verified.',
            'page' => $this->pageSnapshot($verified, $newKey)
        ));
    }

    /**
     * Stable revision identifier for stale-edit detection.
     */
    private function pageRevision($page)
    {
        $parts = array(
            'title' => (string)$page->title(),
            'slug' => (string)$page->slug(),
            'description' => (string)$page->description(),
            'type' => (string)$page->type(),
            'content' => (string)(method_exists($page, 'contentRaw') ? $page->contentRaw() : $page->content())
        );
        return hash('sha256', json_encode($parts));
    }

    /**
     * Read-only snapshot of an existing page for the review panel.
     */
    private function pageReviewSnapshot($page, $key)
    {
        return array(
            'key' => $key,
            'title' => $page->title(),
            'slug' => $page->slug(),
            'description' => $page->description(),
            'type' => $page->type(),
            'content' => (string)(method_exists($page, 'contentRaw') ? $page->contentRaw() : $page->content()),
            'revision' => $this->pageRevision($page)
        );
    }

    private function pageSnapshot($page, $key)
    {
        if (!$page) {
            return array('key' => $key);
        }

        return array(
            'key' => $key,
            'title' => $page->title(),
            'description' => $page->description(),
            'type' => $page->type(),
            'permalink' => $page->permalink()
        );
    }

    private function json($data, $status = 200, $headers = array())
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        foreach ($headers as $header) {
            header($header);
        }
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function redirectWith($status)
    {
        $url = HTML_PATH_ADMIN_ROOT . 'plugin/pluginwizard?status=' . rawurlencode($status);
        header('Location: ' . $url);
        exit;
    }

    public function adminSidebar()
    {
        $pluginName = strtolower(get_class($this));
        $url = HTML_PATH_ADMIN_ROOT . 'plugin/' . $pluginName;

        return '<a class="nav-link" href="' . $url . '"><i class="fa fa-magic"></i> Wizard</a>';
    }

    /**
     * Full page list for the task page selector (not truncated for context).
     */
    private function getPageOptions()
    {
        global $pages;
        $items = array();
        foreach ($pages->getDB(true) as $key) {
            $page = buildPage($key);
            if (!$page) {
                continue;
            }
            $items[] = array(
                'key' => $key,
                'title' => $page->title(),
                'type' => $page->type()
            );
            if (count($items) >= 1000) {
                break;
            }
        }
        return $items;
    }

    public function adminView()
    {
        global $security, $pages;

        $tokenCSRF = $security->getTokenCSRF();
        $pageOptions = $this->getPageOptions();
        $totalPages = count($pages->getDB(true));
        $tasks = $this->taskDefinitions();
        $taskKeys = array_keys($tasks);
        $defaultAction = isset($tasks[$taskKeys[0]]['action']) ? $tasks[$taskKeys[0]]['action'] : 'Run Wizard';

        $status = isset($_GET['status']) ? Sanitize::html($_GET['status']) : '';

        $html = '';
        $html .= '<link rel="stylesheet" href="' . $this->assetUrl('css/wizard.css') . '">';
        $html .= '<div class="bw-shell">';

        // Hero: dark header, accessible heading contrast, accurate page count.
        $html .= '<div class="bw-hero">';
        $html .= '<div><div class="bw-kicker">BLUDIT WIZARD</div><h1>What do you want to do?</h1><p class="bw-subtitle">Your intelligent Bludit publishing companion.</p><p class="bw-lede">Choose a task, review every proposal, and apply changes only when you are ready.</p></div>';
        $html .= '<div class="bw-stat"><strong>' . $totalPages . '</strong><span>pages indexed</span></div>';
        $html .= '</div>';

        if ($status === 'saved') {
            $html .= '<div class="alert alert-success">Settings saved.</div>';
        }

        if ($this->adminNotice !== '') {
            $html .= '<div class="alert alert-warning bw-admin-notice" role="alert">' . htmlspecialchars($this->adminNotice, ENT_QUOTES, 'UTF-8') . '</div>';
        }

        // A single full-width workspace. No permanent sidebar.
        $html .= '<section class="bw-card bw-workspace">';
        $html .= '<noscript><div class="alert alert-warning bw-noscript" role="alert">Bludit Wizard needs JavaScript to run tasks and review proposals. Nothing has been run or saved. Enable JavaScript and reload this page.</div></noscript>';
        $html .= '<form id="bw-ai-form" method="post">';
        $html .= '<input type="hidden" name="tokenCSRF" value="' . htmlspecialchars($tokenCSRF, ENT_QUOTES, 'UTF-8') . '">';
        // Server-recognised dispatch: a native form POST (JavaScript missing,
        // blocked or stale) must never fall through to "Unknown action."
        // See DECISION_LOG D-0051 and D-0052.
        $html .= '<input type="hidden" name="action" value="ai">';

        $html .= '<div class="form-group bw-task-select">';
        $html .= '<label for="bw-task">Task</label>';
        $html .= '<select class="form-control" id="bw-task" name="task">';
        $grouped = array();
        foreach ($tasks as $key => $def) {
            $grouped[$def['category']][$key] = $def;
        }
        foreach ($grouped as $category => $items) {
            $html .= '<optgroup label="' . htmlspecialchars($category, ENT_QUOTES, 'UTF-8') . '">';
            foreach ($items as $key => $def) {
                $html .= '<option value="' . htmlspecialchars($key, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($def['label'], ENT_QUOTES, 'UTF-8') . '</option>';
            }
            $html .= '</optgroup>';
        }
        $html .= '</select>';
        $html .= '</div>';

        $html .= '<p class="bw-guidance" id="bw-guidance"></p>';

        $html .= '<div class="form-group" id="bw-page-wrap">';
        $html .= '<label for="bw-page">Page</label>';
        $html .= '<select class="form-control" id="bw-page" name="pageKey">';
        $html .= '<option value="" id="bw-page-none">— No page — general question —</option>';
        foreach ($pageOptions as $page) {
            $html .= '<option value="' . htmlspecialchars($page['key'], ENT_QUOTES, 'UTF-8') . '">' .
                htmlspecialchars($page['title'], ENT_QUOTES, 'UTF-8') . ' (' . htmlspecialchars($page['type'], ENT_QUOTES, 'UTF-8') . ')</option>';
        }
        $html .= '</select>';
        $html .= '<small class="form-text text-muted" id="bw-page-hint"></small>';
        $html .= '</div>';

        $html .= '<div class="form-group" id="bw-tone-wrap" hidden>';
        $html .= '<label for="bw-tone">Target tone or style</label>';
        $html .= '<input class="form-control" id="bw-tone" type="text" name="tone" placeholder="Example: conversational, formal, technical, playful">';
        $html .= '</div>';

        $html .= '<div class="form-group" id="bw-length-wrap" hidden>';
        $html .= '<label for="bw-length-mode">Length change</label>';
        $html .= '<select class="form-control" id="bw-length-mode" name="lengthMode"><option value="expand">Expand</option><option value="shorten">Shorten</option></select>';
        $html .= '<label for="bw-length-notes" class="bw-label-spaced">Additional length instructions (optional)</label>';
        $html .= '<input class="form-control" id="bw-length-notes" type="text" name="lengthNotes" placeholder="Example: Aim for about 600 words and keep the existing structure.">';
        $html .= '</div>';

        $html .= '<div class="form-group">';
        $html .= '<label for="bw-prompt" id="bw-prompt-label">Instruction</label>';
        $html .= '<textarea class="form-control" id="bw-prompt" name="prompt" rows="5"></textarea>';
        $html .= '</div>';

        $html .= '<button class="btn btn-primary" id="bw-run" type="submit">' . htmlspecialchars($defaultAction, ENT_QUOTES, 'UTF-8') . '</button>';
        $html .= '</form>';

        // Text / audit / conversational result.
        $html .= '<div id="bw-result" class="bw-result" hidden>';
        $html .= '<div class="bw-result-head"><strong id="bw-result-title">Result</strong><button type="button" class="btn btn-sm btn-light" id="bw-copy">Copy Markdown</button></div>';
        $html .= '<div id="bw-result-body" class="bw-markdown" tabindex="-1"></div>';
        $html .= '<details id="bw-result-technical" class="bw-technical" hidden><summary>Technical details (raw output)</summary><pre id="bw-result-json"></pre></details>';
        $html .= '</div>';

        // Internal-link recommendations (read-only).
        $html .= '<div id="bw-audit" class="bw-audit" hidden>';
        $html .= '<h3 id="bw-audit-heading" tabindex="-1">Internal link opportunities</h3>';
        $html .= '<div id="bw-audit-body"></div>';
        $html .= '</div>';

        // Original vs Proposed review for write-capable tasks.
        $html .= '<div id="bw-review" class="bw-review" hidden>';
        $html .= '<h3 class="bw-review-title" id="bw-review-heading" tabindex="-1">Review proposed changes</h3>';
        $html .= '<div class="bw-review-grid">';

        $html .= '<section class="bw-review-col bw-original" id="bw-original-col" hidden>';
        $html .= '<h4>Original</h4>';
        $html .= '<dl class="bw-review-facts">';
        $html .= '<dt>Title</dt><dd id="bw-original-title"></dd>';
        $html .= '<dt>Slug</dt><dd id="bw-original-slug"></dd>';
        $html .= '<dt>Description</dt><dd id="bw-original-description"></dd>';
        $html .= '<dt>Status</dt><dd id="bw-original-type"></dd>';
        $html .= '</dl>';
        $html .= '<div class="bw-review-content"><pre id="bw-original-content"></pre></div>';
        $html .= '</section>';

        $html .= '<section class="bw-review-col bw-proposed">';
        $html .= '<h4>Proposed</h4>';
        $html .= '<div class="bw-proposed-grid">';
        $html .= '<div><label for="bw-title">Title</label><input class="form-control" id="bw-title"></div>';
        $html .= '<div><label for="bw-slug">Slug</label><input class="form-control" id="bw-slug"></div>';
        $html .= '<div><label for="bw-description">Description</label><input class="form-control" id="bw-description"></div>';
        $html .= '<div><label for="bw-type">Status</label><select class="form-control" id="bw-type"><option value="draft">Draft</option><option value="published">Published</option><option value="static">Static</option><option value="sticky">Sticky</option><option value="scheduled">Scheduled</option></select></div>';
        $html .= '</div>';
        $html .= '<div id="bw-content-wrap"><label for="bw-content">Content</label><textarea class="form-control" id="bw-content" rows="16"></textarea></div>';
        $html .= '<p class="bw-note" id="bw-metadata-note" hidden>Only the title, description and slug will change. Content and status stay exactly as they are.</p>';
        $html .= '</section>';

        $html .= '</div>';
        $html .= '<details id="bw-review-technical" class="bw-technical" hidden><summary>Technical details (raw JSON)</summary><pre id="bw-review-json"></pre></details>';
        $html .= '<div class="bw-apply-actions">';
        $html .= '<button class="btn btn-success" type="button" id="bw-save">Apply this change</button>';
        $html .= '<button class="btn btn-outline-secondary" type="button" id="bw-discard">Discard suggestion</button>';
        $html .= '</div>';
        $html .= '</div>';

        $html .= '</section>';
        $html .= '</div>';

        $taskConfig = array();
        foreach ($tasks as $key => $def) {
            $taskConfig[$key] = array(
                'label' => $def['label'],
                'category' => $def['category'],
                'action' => $def['action'],
                'page' => $def['page'],
                'result' => $def['result'],
                'editable' => $def['editable'],
                'promptRequired' => $def['promptRequired'],
                'promptLabel' => $def['promptLabel'],
                'placeholder' => $def['placeholder'],
                'guidance' => $def['guidance'],
                'options' => $def['options']
            );
        }

        $html .= '<script>window.BW_CONFIG=' . json_encode(array(
            'token' => $tokenCSRF,
            'endpoint' => HTML_PATH_ADMIN_ROOT . 'plugin/pluginwizard',
            'tasks' => $taskConfig
        ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) . ';</script>';
        $html .= '<script src="' . $this->assetUrl('js/wizard.js') . '"></script>';

        return $html;
    }
}
?>