<?php
declare(strict_types=1);

namespace CRA1\Theme\Presentation;

final class Footer
{
    /** Remove the retired theme name from copyright display only, never stored content. */
    public static function copyrightText(string $text): string
    {
        $clean = preg_replace('/\bCloud[ \t]+Theme\b/i', '', $text);
        if ($clean === $text || $clean === null) return $text;
        return trim((string)preg_replace('/[ \t]{2,}/', ' ', $clean));
    }
}
