<?php
/**
 * EducandoW — API Proxy
 * Bridges Hostinger HTTPS → VPS HTTP on the VPS side.
 * Place as v1/index.php on Hostinger.
 * Requires .htaccess rewrite: RewriteRule ^v1/(.*) /v1/index.php?_v1_path=$1 [L,QSA]
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$VPS_HOST = '86.48.23.197';  // Cambiar si el VPS tiene otra IP
$VPS_PORT = 3001;

$path = $_GET['_v1_path'] ?? '';
$url = "http://{$VPS_HOST}:{$VPS_PORT}/v1/{$path}";

$ch = curl_init($url);

// Forward original method
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

// Forward body for POST/PUT/PATCH
$body = file_get_contents('php://input');
if ($body) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

// Forward headers
$headers = [];
foreach (getallheaders() as $name => $value) {
    if (strtolower($name) === 'host') continue;
    $headers[] = "$name: $value";
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(502);
    echo json_encode(['error' => 'API unavailable', 'detail' => $error]);
    exit;
}

// Split headers from body
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

// Forward relevant response headers
foreach (explode("\r\n", $responseHeaders) as $header) {
    if (stripos($header, 'Set-Cookie:') === 0 ||
        stripos($header, 'Content-Type:') === 0) {
        header($header);
    }
}

http_response_code($httpCode);
echo $responseBody;
