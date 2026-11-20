<?php
declare(strict_types=1);
namespace CRA1\Theme\Presentation;

/** Publish complete CRA1 compiled templates without truncating files in use by OPcache. */
final class TemplateCache extends \think\template\driver\File
{
    public function write(string $cacheFile, string $content): void
    {
        // Native and third-party views retain their existing storage behavior.
        $header = strstr($content, '*/', true);
        if ($header === false || !preg_match('~/public/(?:web/cra1|(?:clientarea|cart)/template/(?:pc|mobile)/cra1)/~', $header)) {
            parent::write($cacheFile, $content);
            return;
        }
        $dir = dirname($cacheFile);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('主题模板缓存目录无法创建');
        }
        // Same-directory rename leaves already executing readers on the old inode.
        $temp = $dir.'/.cra1-'.bin2hex(random_bytes(12)).'.tmp';
        $handle = @fopen($temp, 'xb');
        if ($handle === false) throw new \RuntimeException('主题模板缓存无法写入');
        try {
            $length = strlen($content);
            for ($offset = 0; $offset < $length; $offset += $written) {
                $written = fwrite($handle, substr($content, $offset));
                if ($written === false || $written === 0) throw new \RuntimeException('主题模板缓存写入未完成');
            }
            if (!fflush($handle)) throw new \RuntimeException('主题模板缓存写入未完成');
            fclose($handle);
            $handle = null;
            if (!@rename($temp, $cacheFile)) throw new \RuntimeException('主题模板缓存无法保存');
            clearstatcache(true, $cacheFile);
            if (function_exists('opcache_invalidate')) @opcache_invalidate($cacheFile, true);
        } finally {
            if (is_resource($handle)) fclose($handle);
            if (is_file($temp)) @unlink($temp);
        }
    }
}
