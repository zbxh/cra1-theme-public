<?php
declare(strict_types=1);

namespace CRA1\Theme\Content;

use DateTimeImmutable;
use DateTimeZone;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;
use InvalidArgumentException;

/** One HTML format for administration, storage and all theme-owned rich content. */
final class ContentDocument
{
    public const MAX_BYTES = 262144;
    private const COMPONENTS = ['cra1-timed', 'cra1-more', 'cra1-tabs', 'cra1-tab', 'cra1-icon', 'cra1-callout'];
    private const CALLOUTS = ['info' => '信息', 'notice' => '提醒', 'warning' => '警告'];
    private const TAGS = [
        'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup',
        'span', 'div', 'section', 'figure', 'figcaption', 'a', 'img', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ];
    private const STYLES = [
        'color', 'background', 'background-color', 'background-image', 'font-size',
        'font-weight', 'font-style', 'text-align', 'text-decoration', 'line-height',
        'letter-spacing', 'white-space', 'border-radius', 'padding', 'margin', 'display',
        'vertical-align', 'border', 'border-color', 'border-width', 'border-style',
        'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
        'overflow', 'overflow-wrap', 'word-break', 'box-shadow', 'gap', 'flex',
        'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
    ];
    private const BLOCKS = ['p','br','div','section','figcaption','li','tr','td','th','h1','h2','h3','h4','h5','h6','blockquote','pre'];
    private DateTimeZone $timezone;
    private ?int $now;
    private ?int $next = null;

    private function __construct(?int $now)
    {
        $this->now = $now;
        $this->timezone = self::timezone();
    }

    public static function timezone(): DateTimeZone
    {
        static $zone;
        if ($zone instanceof DateTimeZone) return $zone;
        $name = '';
        if (function_exists('config')) {
            try { $name = (string) \config('app.default_timezone'); } catch (\Throwable $e) {}
        }
        // Standalone endpoints do not boot V10. Read the literal application
        // setting without executing config/app.php and its framework helpers.
        if ($name === '' && defined('CRA1_THEME_ROOT')) {
            $file = CRA1_THEME_ROOT.'/config/app.php';
            if (is_readable($file) && preg_match('/^[ \t]*[\'"]default_timezone[\'"]\s*=>\s*[\'"]([A-Za-z0-9_+\/-]+)[\'"]/m', (string) file_get_contents($file), $match)) {
                $name = $match[1];
            }
        }
        try { $zone = new DateTimeZone($name ?: date_default_timezone_get()); }
        catch (\Exception $e) { $zone = new DateTimeZone(date_default_timezone_get()); }
        return $zone;
    }

    /** Strict saves reject invalid component structure. Legacy reads keep safe neighbouring content. */
    public static function normalize(string $html, bool $strict = false): string
    {
        if ($strict && strlen($html) > self::MAX_BYTES) throw new InvalidArgumentException('内容超过编辑器大小限制');
        $fragment = (new self(null))->fragment($html, $strict);
        return $fragment === null ? '' : self::serialize($fragment);
    }

    /** Null time is the persistent projection. It never contains any timed body. */
    public static function project(string $html, ?int $now): array
    {
        $document = new self($now);
        $fragment = $document->fragment($html, false);
        return $document->projection($fragment);
    }

    public static function preview(string $html, int $now): array
    {
        if (strlen($html) > self::MAX_BYTES) throw new InvalidArgumentException('内容超过编辑器大小限制');
        $document = new self($now);
        $fragment = $document->fragment($html, true);
        return $document->projection($fragment) + [
            'source' => $fragment === null ? '' : self::serialize($fragment),
            'server_time' => $now,
            'site_time' => (new DateTimeImmutable('@'.$now))->setTimezone($document->timezone)->format('Y-m-d\TH:i:s'),
            'timezone' => $document->timezone->getName(),
        ];
    }

    public static function containsTimedContent(string $html): bool
    {
        return preg_match('/<\s*cra1-timed\b/i', $html) === 1;
    }

    private function projection(?DOMElement $fragment): array
    {
        $output = $fragment === null ? self::emptyPart() : $this->renderChildren($fragment, true);
        return [
            'html' => $output['visible'] ? $output['html'] : '',
            'text' => trim(preg_replace('/[\s\x{00a0}\x{200b}]+/u', ' ', $output['text']) ?? ''),
            'next_change' => $this->next,
        ];
    }

    private function fragment(string $html, bool $strict): ?DOMElement
    {
        if (trim($html) === '') return null;
        $doc = new DOMDocument('1.0', 'UTF-8');
        $errors = libxml_use_internal_errors(true);
        try {
            $doc->loadHTML('<?xml encoding="utf-8"?><html><body><div id="cra1-content-root">'.$html.'</div></body></html>', LIBXML_NONET);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($errors);
        }
        $root = $doc->getElementById('cra1-content-root');
        if (!$root) return null;
        $more = false;
        $this->cleanChildren($root, $root, $strict, $more);
        return $root;
    }

    private function cleanChildren(DOMElement $parent, DOMElement $root, bool $strict, bool &$more): void
    {
        foreach (iterator_to_array($parent->childNodes) as $node) {
            if ($node instanceof DOMText) {
                if ($parent->tagName === 'cra1-tabs' && trim($node->nodeValue) !== '') {
                    if ($strict) throw new InvalidArgumentException('标签页组内请使用 cra1-tab 放置正文');
                    $parent->removeChild($node);
                }
                continue;
            }
            if (!$node instanceof DOMElement) {
                $parent->removeChild($node);
                continue;
            }
            $tag = $node->tagName;
            if (in_array($tag, self::COMPONENTS, true)) {
                try { $attrs = $this->componentAttributes($node, $root, $more); }
                catch (InvalidArgumentException $e) {
                    if ($strict) throw $e;
                    $parent->removeChild($node);
                    continue;
                }
            } else {
                if ($parent->tagName === 'cra1-tabs') {
                    if ($strict) throw new InvalidArgumentException('标签页组内请使用 cra1-tab 放置正文');
                    $parent->removeChild($node);
                    continue;
                }
                if (!in_array($tag, self::TAGS, true)) {
                    $parent->removeChild($node);
                    continue;
                }
                $attrs = self::presentationAttributes($node);
                if ($tag === 'img' && !isset($attrs['src'])) {
                    $parent->removeChild($node);
                    continue;
                }
            }
            foreach (iterator_to_array($node->attributes) as $attr) $node->removeAttribute($attr->name);
            foreach ($attrs as $name => $value) $node->setAttribute($name, $value);
            if ($tag !== 'cra1-more' && $tag !== 'cra1-icon') $this->cleanChildren($node, $root, $strict, $more);
            if ($tag === 'cra1-tabs' && !$node->getElementsByTagName('cra1-tab')->length) {
                if ($strict) throw new InvalidArgumentException('每个标签页组至少需要一个标签');
                $parent->removeChild($node);
            }
        }
    }

    private function componentAttributes(DOMElement $node, DOMElement $root, bool &$more): array
    {
        $tag = $node->tagName;
        $parent = $node->parentNode;
        if ($parent instanceof DOMElement && $parent->tagName === 'cra1-tabs' && $tag !== 'cra1-tab') {
            throw new InvalidArgumentException('标签页组内请使用 cra1-tab 放置正文');
        }
        if ($tag === 'cra1-timed') {
            $start = $this->date($node->getAttribute('start'));
            $end = $this->date($node->getAttribute('end'));
            if ($start === null && $end === null) throw new InvalidArgumentException('限时内容至少需要开始或到期时间');
            if ($start !== null && $end !== null && $start >= $end) throw new InvalidArgumentException('限时内容的到期时间必须晚于开始时间');
            $attrs = [];
            if ($start !== null) $attrs['start'] = $start->format('Y-m-d\TH:i:s');
            if ($end !== null) $attrs['end'] = $end->format('Y-m-d\TH:i:s');
            if ($end !== null && $node->getAttribute('show-end') === '1') $attrs['show-end'] = '1';
            return $attrs;
        }
        if ($tag === 'cra1-more') {
            if ($parent !== $root || $more) throw new InvalidArgumentException('每份内容只能在正文顶层放置一个“查看更多”');
            if ($node->hasChildNodes()) throw new InvalidArgumentException('“查看更多”后面的内容应放在标记外');
            $more = true;
            return [];
        }
        if ($tag === 'cra1-tab') {
            $label = trim($node->getAttribute('label'));
            if (!$parent instanceof DOMElement || $parent->tagName !== 'cra1-tabs' || $label === '' || mb_strlen($label) > 80) {
                throw new InvalidArgumentException('请在标签页组内填写 1 至 80 字的标签标题');
            }
            return ['label' => $label];
        }
        if ($tag === 'cra1-icon') {
            $id = trim($node->getAttribute('name'));
            if ($node->hasChildNodes() || !preg_match('/^[a-z0-9][a-z0-9:_-]{0,159}$/iD', $id)) throw new InvalidArgumentException('图标请使用主题图标库中的标识');
            return ['name' => $id];
        }
        if ($tag === 'cra1-callout') {
            $tone = $node->getAttribute('tone');
            $attrs = ['tone' => isset(self::CALLOUTS[$tone]) ? $tone : 'info'];
            $title = trim($node->getAttribute('title'));
            if ($title !== '') $attrs['title'] = mb_substr($title, 0, 80);
            return $attrs;
        }
        for ($ancestor = $parent; $ancestor instanceof DOMElement && $ancestor !== $root; $ancestor = $ancestor->parentNode) {
            if ($ancestor->tagName === 'cra1-tabs') throw new InvalidArgumentException('标签页组不能嵌套使用');
        }
        return [];
    }

    private function date(string $raw): ?DateTimeImmutable
    {
        if ($raw === '') return null;
        $format = strlen($raw) === 16 ? 'Y-m-d\TH:i' : 'Y-m-d\TH:i:s';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/D', $raw)) {
            throw new InvalidArgumentException('限时内容的时间请使用站点当地日期和时间');
        }
        $date = DateTimeImmutable::createFromFormat('!'.$format, $raw, $this->timezone);
        if (!$date || $date->format($format) !== $raw) throw new InvalidArgumentException('限时内容包含无效日期或时间');
        return $date;
    }

    private static function presentationAttributes(DOMElement $node): array
    {
        $tag = $node->tagName;
        $attrs = [];
        if ($node->hasAttribute('style') && !in_array($tag, ['a', 'img'], true)) {
            $style = self::safeStyle($node->getAttribute('style'));
            if ($style !== '') $attrs['style'] = $style;
        }
        if ($tag === 'a') {
            $href = self::safeUrl($node->getAttribute('href'));
            if ($href !== '') {
                $attrs['href'] = $href;
                if ($node->getAttribute('target') === '_blank') $attrs['target'] = '_blank';
                $attrs['rel'] = 'noopener noreferrer';
                if (in_array('cra1-content-link', preg_split('/\s+/', $node->getAttribute('class')), true)) $attrs['class'] = 'cra1-content-link';
            }
        }
        if ($tag === 'img') {
            $src = self::safeUrl($node->getAttribute('src'), true);
            if ($src !== '') {
                $attrs['src'] = $src;
                $attrs['alt'] = mb_substr($node->getAttribute('alt'), 0, 400);
                if (in_array('cra1-content-image-center', preg_split('/\s+/', $node->getAttribute('class')), true)) {
                    $attrs['class'] = 'cra1-content-image-center';
                }
            }
            if ($node->getAttribute('loading') === 'lazy') $attrs['loading'] = 'lazy';
        }
        if ($node->hasAttribute('title') && in_array($tag, ['a', 'img', 'span'], true)) $attrs['title'] = mb_substr($node->getAttribute('title'), 0, 400);
        $numeric = $tag === 'img' ? ['width', 'height'] : (in_array($tag, ['th','td'], true) ? ['colspan','rowspan'] : ($tag === 'ol' ? ['start'] : []));
        foreach ($numeric as $name) {
            if (preg_match('/^\d{1,4}(?:px)?$/D', $node->getAttribute($name))) $attrs[$name] = (string) (int) $node->getAttribute($name);
        }
        return $attrs;
    }

    private static function safeStyle(string $style): string
    {
        $declarations = [];
        foreach (explode(';', $style) as $decl) {
            $parts = explode(':', $decl, 2);
            if (count($parts) !== 2) continue;
            [$name, $value] = array_map('trim', $parts);
            $name = strtolower($name);
            if (!in_array($name, self::STYLES, true) || $value === '' || strlen($value) > 500
                || preg_match('~[\\\\@{}<>!]|/\*|url\s*\(|expression|(?:java|vb)script|(?:https?|data|file)\s*:~i', $value)
                || ($name === 'display' && !in_array($value, ['inline','inline-block','block','flex','inline-flex'], true))) continue;
            $declarations[] = $name.': '.$value;
        }
        return implode('; ', $declarations);
    }

    private static function safeUrl(string $value, bool $image = false): string
    {
        $value = trim($value);
        if ($value === '' || strlen($value) > 2048 || preg_match('~[\x00-\x20\x7f<>"\'\\\\]~', $value) || strpos($value, '//') === 0) return '';
        if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $value) && !preg_match($image ? '~^https?://~i' : '~^(?:https?://|mailto:|tel:)~i', $value)) return '';
        return $value;
    }

    private static function serialize(DOMElement $fragment): string
    {
        $html = '';
        foreach ($fragment->childNodes as $node) $html .= $fragment->ownerDocument->saveHTML($node);
        return trim($html);
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function emptyPart(): array
    {
        return ['html' => '', 'text' => '', 'visible' => false];
    }

    private function renderChildren(DOMElement $parent, bool $supportsMore = false): array
    {
        $before = self::emptyPart();
        $after = self::emptyPart();
        $more = false;
        foreach ($parent->childNodes as $node) {
            if ($supportsMore && $node instanceof DOMElement && $node->tagName === 'cra1-more') {
                $more = true;
                continue;
            }
            $part = $this->renderNode($node);
            if ($more) self::append($after, $part);
            else self::append($before, $part);
        }
        if ($after['visible']) {
            $before['html'] .= '<details class="cra1-content-more"><summary><span>查看更多</span><span>收起</span></summary>'
                .'<div class="cra1-content-more__body">'.$after['html'].'</div></details>';
            $before['visible'] = true;
        }
        return $before;
    }

    private static function append(array &$result, array $part): void
    {
        $result['html'] .= $part['html'];
        $result['text'] .= $part['text'];
        $result['visible'] = $result['visible'] || $part['visible'];
    }

    private function renderNode(DOMNode $node): array
    {
        if ($node instanceof DOMText) {
            $text = $node->nodeValue;
            return ['html' => self::escape($text), 'text' => $text, 'visible' => preg_match('/[^\s\x{00a0}\x{200b}]/u', $text) === 1];
        }
        if (!$node instanceof DOMElement) return self::emptyPart();
        $tag = $node->tagName;
        if ($tag === 'cra1-timed') return $this->renderTimed($node);
        if ($tag === 'cra1-tabs') return $this->renderTabs($node);
        if ($tag === 'cra1-callout') {
            $part = $this->renderChildren($node);
            if (!$part['visible']) return self::emptyPart();
            $tone = $node->getAttribute('tone');
            $title = $node->hasAttribute('title') ? $node->getAttribute('title') : self::CALLOUTS[$tone];
            $part['html'] = '<div class="cra1-content-callout" data-tone="'.$tone.'">'
                .'<strong class="cra1-content-callout__label">'.self::escape($title).'</strong>'.$part['html'].'</div>';
            $part['text'] = ' '.$part['text'].' ';
            return $part;
        }
        if ($tag === 'cra1-icon') {
            $html = $this->renderIcon($node->getAttribute('name'));
            return ['html' => $html, 'text' => '', 'visible' => $html !== ''];
        }
        if (!in_array($tag, self::TAGS, true)) return self::emptyPart();
        $part = $this->renderChildren($node);
        if (in_array($tag, self::BLOCKS, true)) $part['text'] = ' '.$part['text'].' ';
        $open = '<'.$tag;
        foreach ($node->attributes as $attr) $open .= ' '.$attr->name.'="'.self::escape($attr->value).'"';
        $part['html'] = $open.'>'.(in_array($tag, ['img','br','hr'], true) ? '' : $part['html'].'</'.$tag.'>');
        $part['visible'] = $part['visible'] || $tag === 'img' || $tag === 'hr';
        return $part;
    }

    private function markChange(?int $time): void
    {
        if ($time !== null && ($this->next === null || $time < $this->next)) $this->next = $time;
    }

    private function renderTimed(DOMElement $node): array
    {
        if ($this->now === null) return self::emptyPart();
        $start = $this->date($node->getAttribute('start'));
        $end = $this->date($node->getAttribute('end'));
        if ($end !== null && $end->getTimestamp() <= $this->now) return self::emptyPart();
        if ($start !== null && $start->getTimestamp() > $this->now) {
            $this->markChange($start->getTimestamp());
            return self::emptyPart();
        }
        $this->markChange($end === null ? null : $end->getTimestamp());
        $part = $this->renderChildren($node);
        if (!$part['visible']) return self::emptyPart();
        $ttl = $end === null ? '' : ' data-cra1-content-ttl="'.($end->getTimestamp() - $this->now).'"';
        $schedule = '';
        if ($end !== null && $node->getAttribute('show-end') === '1') {
            $format = $end->format('s') === '00' ? 'Y-m-d H:i' : 'Y-m-d H:i:s';
            $schedule = '<div class="cra1-content-timed__end">'.$this->renderIcon('clock')
                .'<time datetime="'.$end->format(DATE_ATOM).'">'.$end->format($format).'</time></div>';
        }
        $part['html'] = '<div class="cra1-content-timed"'.$ttl.'>'.$schedule.$part['html'].'</div>';
        return $part;
    }

    private function renderTabs(DOMElement $node): array
    {
        $tabs = [];
        foreach ($node->childNodes as $tab) {
            if (!$tab instanceof DOMElement) continue;
            $part = $this->renderChildren($tab);
            if ($part['visible']) $tabs[] = $part + ['label' => $tab->getAttribute('label')];
        }
        if (!$tabs) return self::emptyPart();
        $buttons = '';
        $panels = '';
        foreach ($tabs as $tab) {
            $label = self::escape($tab['label']);
            $buttons .= '<button type="button" role="tab">'.$label.'</button>';
            $panels .= '<section data-cra1-content-panel><p data-cra1-content-tab-label>'.$label.'</p>'.$tab['html'].'</section>';
        }
        return [
            'html' => '<div class="cra1-content-tabs" data-cra1-content-tabs><div role="tablist" aria-label="内容分类" hidden>'.$buttons.'</div>'.$panels.'</div>',
            'text' => ' '.$tabs[0]['label'].' '.$tabs[0]['text'].' ',
            'visible' => true,
        ];
    }

    private function renderIcon(string $id): string
    {
        if (!function_exists('cra1_icons_resolve') && defined('CRA1_THEME_ROOT')) {
            $path = CRA1_THEME_ROOT.'/public/cra1-shared/icons.php';
            if (is_file($path)) require_once $path;
        }
        if (!function_exists('cra1_icon_art')) return '';
        $icon = \cra1_icons_resolve($id, 'website');
        if (empty($icon['available']) || !empty($icon['external'])) return '';
        return '<span class="cra1-content-icon">'.\cra1_icon_art($id, 'website').'</span>';
    }
}
