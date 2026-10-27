<?php
/** Fixed projection of currently effective public notifications; never exposes editor settings. */
declare(strict_types=1);
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
\CRA1\Theme\Announcements\Endpoint::serveAll();
