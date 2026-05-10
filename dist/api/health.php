<?php
require __DIR__ . '/_bootstrap.php';

api_require_method('GET');
api_send_json(200, ['ok' => true, 'runtime' => 'php']);

