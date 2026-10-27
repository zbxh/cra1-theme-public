<?php
/** Fixed, read-only announcement projection. No administrator session or arbitrary settings. */
declare(strict_types=1);
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
\CRA1\Theme\Announcements\Endpoint::serve();
