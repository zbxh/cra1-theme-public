/**
 * 酷锐A1主题控制器 —— Alpine.js 全局 store 与页面组件
 * 契约见《主题开发需求文档-官网.md》第 6 章
 */
(function () {
  'use strict';

  document.addEventListener('alpine:init', function () {
    // The product section directory follows its visible, configured anchors.
    Alpine.data('pageSections', function () {
      return {
        active: '', _links: [], _frame: null,
        init: function () {
          var self = this, nav = this.$el, header = document.querySelector('.cra1-site-header');
          this._links = Array.from(nav.querySelectorAll('a[href^="#"]')).map(function (link) {
            return { id: link.hash.slice(1), link: link, section: document.getElementById(link.hash.slice(1)) };
          }).filter(function (item) { return item.section; });
          this._measure = function () {
            var headerHeight = header ? header.getBoundingClientRect().height : 0;
            var height = nav.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--cra1-header-offset', headerHeight + 'px');
            document.documentElement.style.setProperty('--cra1-scroll-offset', (headerHeight + height + 16) + 'px');
            self._offset = headerHeight + height + 20;
            self._sync();
          };
          this._sync = function () {
            if (self._frame !== null) return;
            self._frame = requestAnimationFrame(function () {
              self._frame = null;
              var current = self._links[0];
              self._links.forEach(function (item) { if (item.section.getBoundingClientRect().top <= self._offset) current = item; });
              var id = current ? current.id : '';
              if (self.active !== id) {
                self.active = id;
                if (current) self.showLink(current.link);
              }
            });
          };
          this._click = function (event) {
            var link = event.target.closest('a[href^="#"]');
            if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
            var target = document.getElementById(link.hash.slice(1));
            if (!target) return;
            event.preventDefault(); self._measure();
            target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            history.replaceState(null, '', link.hash);
          };
          nav.addEventListener('click', this._click);
          window.addEventListener('scroll', this._sync, { passive: true });
          this._observer = new ResizeObserver(this._measure);
          this._observer.observe(nav); if (header) this._observer.observe(header);
          this._measure();
          this.$nextTick(function () {
            var hash = window.location.hash.slice(1), target = document.getElementById(hash);
            if (target && self._links.some(function (item) { return item.id === hash; })) target.scrollIntoView({block:'start',behavior:'instant'});
          });
        },
        showLink: function (link) {
          var rail = link.parentElement, rect = link.getBoundingClientRect(), bounds = rail.getBoundingClientRect();
          if (rect.left < bounds.left + 12 || rect.right > bounds.right - 12) rail.scrollBy({left: rect.left - bounds.left - (bounds.width - rect.width) / 2, behavior: 'instant'});
        },
        destroy: function () {
          this.$el.removeEventListener('click', this._click);
          window.removeEventListener('scroll', this._sync);
          if (this._observer) this._observer.disconnect();
          if (this._frame !== null) cancelAnimationFrame(this._frame);
        }
      };
    });

    Alpine.data('nodesMap', function () {
      return {
        openNode: null, selectedNode: 0, compact: true,
        regionReady: false, regionOpen: false, activeRegion: 0, regionAbove: false, regionMaxHeight: 280,
        init: function () {
          var self = this;
          this._query = window.matchMedia('(max-width: 1023px)');
          this._resize = function () { self.compact = self._query.matches; self.openNode = null; self.layout(); };
          this._query.addEventListener('change', this._resize);
          this._observer = new ResizeObserver(this._resize);
          this._observer.observe(this.$refs.map); this._resize();
          this._regionViewport = function () { self.regionOpen = false; };
          window.addEventListener('resize', this._regionViewport);
          this.$nextTick(function () { self.regionReady = !!(self.$refs.regionNative && self.$refs.regionNative.options.length); });
        },
        hoverNode: function (index, event) { if (!this.compact && event.pointerType === 'mouse') { this.regionOpen = false; this.openNode = index; this.selectedNode = index; } },
        selectNode: function (index) { this.selectedNode = Number(index); this.regionOpen = false; this.openNode = this.compact ? null : this.selectedNode; },
        regionLabel: function () {
          var option = this.$refs.regionNative && this.$refs.regionNative.options[Number(this.selectedNode)];
          return option ? option.textContent.trim() : '请选择地区';
        },
        toggleRegions: function () {
          if (this.regionOpen) { this.regionOpen = false; return; }
          var options = this.$refs.regionNative.options;
          if (!options.length) return;
          this.openNode = null;
          this.activeRegion = Math.max(0, Math.min(options.length - 1, Number(this.selectedNode) || 0));
          // Keep the menu inside both the viewport and the clipped map section.
          var trigger = this.$refs.regionTrigger.getBoundingClientRect(), section = this.$refs.map.closest('section').getBoundingClientRect();
          var header = document.querySelector('.cra1-site-header'), headerBounds = header && header.getBoundingClientRect();
          var viewportTop = headerBounds && headerBounds.top < 8 && headerBounds.bottom > 0 ? headerBounds.bottom + 8 : 8;
          var row = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches ? 44 : 40;
          var required = Math.min(280, options.length * row + 12);
          var below = Math.max(0, Math.min(window.innerHeight - 8, section.bottom - 8) - trigger.bottom - 8);
          var above = Math.max(0, trigger.top - Math.max(viewportTop, section.top + 8) - 8);
          this.regionAbove = below < required && above > below;
          this.regionMaxHeight = Math.max(row + 12, Math.min(required, this.regionAbove ? above : below));
          this.regionOpen = true;
          this.scrollActiveRegion();
        },
        chooseRegion: function (index) {
          if (!this.$refs.regionNative.options[Number(index)]) return;
          this.selectNode(index);
          var self = this;
          this.$nextTick(function () { self.$refs.regionTrigger.focus({preventScroll: true}); });
        },
        scrollActiveRegion: function () {
          var self = this;
          this.$nextTick(function () {
            var menu = self.$refs.regionMenu, option = menu && menu.querySelectorAll('[role="option"]')[self.activeRegion];
            if (!option) return;
            if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
            else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
          });
        },
        regionKeydown: function (event) {
          if (event.key === 'Tab') { this.regionOpen = false; return; }
          if (event.key === 'Escape') {
            if (this.regionOpen) { event.preventDefault(); event.stopPropagation(); this.regionOpen = false; this.$refs.regionTrigger.focus({preventScroll: true}); }
            return;
          }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Enter' || event.key === ' ') {
            if (this.regionOpen) this.chooseRegion(this.activeRegion); else this.toggleRegions();
            return;
          }
          var wasOpen = this.regionOpen;
          if (!wasOpen) this.toggleRegions();
          var count = this.$refs.regionNative.options.length;
          if (event.key === 'Home') this.activeRegion = 0;
          else if (event.key === 'End') this.activeRegion = count - 1;
          else if (wasOpen) this.activeRegion = (this.activeRegion + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
          this.scrollActiveRegion();
        },
        layout: function () {
          var map = this.$refs.map, svg = this.$refs.leaders, size = map.getBoundingClientRect();
          if (!size.width || !size.height) return;
          svg.replaceChildren(); svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
          var placed = [], self = this;
          Array.from(map.querySelectorAll('.node-dot')).forEach(function (dot) {
            var ox = Number(dot.dataset.nodeX) * size.width / 100, oy = Number(dot.dataset.nodeY) * size.height / 100;
            var x = ox, y = oy;
            if (!self.compact) {
              for (var step = 0; step < 300; step++) {
                if (placed.every(function (point) { return Math.hypot(point.x-x,point.y-y) >= 28; })) break;
                var radius = 5 + Math.floor(step / 12) * 5, angle = step % 12 * Math.PI / 6;
                x = Math.max(14, Math.min(size.width - 14, ox + Math.cos(angle) * radius));
                y = Math.max(14, Math.min(size.height - 14, oy + Math.sin(angle) * radius));
              }
            }
            placed.push({x:x,y:y}); dot.style.left = (x / size.width * 100) + '%'; dot.style.top = (y / size.height * 100) + '%';
            if (Math.hypot(x-ox,y-oy)>3) {
              var line = document.createElementNS('http://www.w3.org/2000/svg','line');
              line.setAttribute('x1',ox);line.setAttribute('y1',oy);line.setAttribute('x2',x);line.setAttribute('y2',y);svg.appendChild(line);
            }
          });
        },
        destroy: function () { this._query.removeEventListener('change', this._resize); this._observer.disconnect(); window.removeEventListener('resize', this._regionViewport); }
      };
    });

    /* ================= 全局 store：auth（登录态） ================= */
    Alpine.store('auth', {
      user: null,
      loggedIn: false,
      checked: false,
      checking: false,
      error: '',
      _checkId: 0,

      /** 页面加载时调用：校验 jwt，401 即未登录 */
      check: function () {
        var self = this;
        var id = ++self._checkId, token = CRA1Shared.Request.getToken();
        self.error = '';
        if (!token) { self.clear(); return Promise.resolve(); }
        self.checking = true;
        function current() { return id === self._checkId && token === CRA1Shared.Request.getToken(); }
        return CRA1Shared.Access.read().then(function (access) {
          return API.get(CRA1Shared.Access.can(access, 'Account::index') ? '/account' : '/index');
        })
          .then(function (data) {
            if (!current()) return;
            self.user = (data && (data.account || data)) || null;
            self.loggedIn = !!self.user;
            if (self.user) CRA1Shared.Avatar.register(self.user);
          })
          .catch(function (error) {
            if (!current()) return;
            if (Number(error && error.status) === 401) self.clear();
            else self.error = '登录状态暂时无法确认，点击重试';
          })
          .then(function () {
            if (id === self._checkId) { self.checked = true; self.checking = false; }
          });
      },

      clear: function () {
        this._checkId++;
        this.user = null;
        this.loggedIn = false;
        this.checked = true;
        this.checking = false;
        this.error = '';
        try { localStorage.removeItem('jwt'); } catch (e) {}
      },

      logout: function () {
        var self = this;
        return API.post('/logout')
          .catch(function () {})
          .then(function () {
            self.clear();
            window.location.href = '/';
          });
      },

      goToAuth: function (url) {
        try { sessionStorage.setItem('redirectUrl', window.location.href); } catch (e) {}
        window.location.href = url || '/login.htm';
      },

      /** 兼容旧模板调用 */
      requireLogin: function () {
        this.goToAuth('/login.htm');
      },

      displayName: function () {
        var u = this.user;
        if (!u) return '';
        return u.username || u.name || u.email || u.phone || '会员';
      },

      /** 头像占位字母：取显示名首字符并大写 */
      initial: function () {
        return (this.displayName() || '?').slice(0, 1).toUpperCase();
      },

      /** 头像上的字符：始终显示首字母，叠在生成头像的渐变之上 */
      avatarText: function () {
        return CRA1Shared.Avatar.letter(this.user);
      },

      /** 头像背景样式：委托共享实现（官网与会员中心同一套算法） */
      avatarStyle: function () {
        return CRA1Shared.Avatar.style(this.user);
      },

      /** 账号 ID（会员中心下拉的「账号 ID：」） */
      accountId: function () {
        var u = this.user;
        return u && u.id ? String(u.id) : '-';
      },

      /** 邮箱或手机号（顶栏副标题） */
      contact: function () {
        var u = this.user;
        if (!u) return '';
        return u.email || u.phone || '';
      },

      /** 可用余额，按接口返回的货币前缀格式化（与会员中心一致） */
      credit: function () {
        var u = this.user;
        if (!u) return '';
        return CRA1Shared.Runtime.money(u.credit || 0);
      },
    });

    /* ================= 全局 store：ui（界面状态 + 菜单） ================= */
    Alpine.store('ui', {
      path: window.location.pathname,
      menuOpen: false,
      megaCat: 'products',

      toggleMenu: function () {
        this.menuOpen = !this.menuOpen;
        document.documentElement.style.overflow = this.menuOpen ? 'hidden' : '';
      },
      closeMenu: function () {
        this.menuOpen = false;
        document.documentElement.style.overflow = '';
      },
      /** 导航高亮：传入页面关键字 */
      isActive: function (key) {
        var path = this.path;
        if (key === 'home') {
          return path === '/' || path === '/index.html';
        }
        return path.indexOf(key) > -1;
      },
    });

    /* Configured text navigation. Shared popovers own dismissal and header exclusivity. */
    Alpine.data('headerMenu', function () {
      return {
        open: false, activeGroup: 0,
        _root: null, _popover: null, _onResize: null, _groupTimer: null, _focusFrame: null,
        init: function () {
          var self = this;
          this._root = this.$el;
          this._onResize = function () {
            if (!self.$refs.navTrigger.getClientRects().length) self.close();
            else if (self.open) self.position();
          };
          window.addEventListener('resize', this._onResize);
          this.$watch('$store.ui.menuOpen', function (value) { if (value) self.close(); });
          this.$nextTick(function () {
            self._popover = CRA1Shared.UI.createPopover({
              root: self._root, trigger: self.$refs.navTrigger, panel: self.$refs.navPanel,
              manageVisibility: false, hover: true,
              onOpenChange: function (value) {
                self.cancelGroup();
                // Position while hidden too: x-show can apply display one frame after nextTick.
                if (value) self.position();
                self.open = value;
                if (value) self.$nextTick(function () { self.position(); });
              }
            });
          });
        },
        position: function () {
          var host = this._root.getBoundingClientRect(), panel = this.$refs.navPanel;
          var nav = this._root.closest('.cra1-primary-nav');
          var trigger = this.$refs.navTrigger.getBoundingClientRect();
          var viewport = document.documentElement.clientWidth;
          var width = 1016;
          // Use one centered width for every menu and keep their pointers inside the card.
          nav.querySelectorAll('.cra1-nav-trigger').forEach(function (item) {
            var bounds = item.getBoundingClientRect(), center = bounds.left + bounds.width / 2;
            width = Math.max(width, viewport - 2 * (center - 48), 2 * (center + 48) - viewport);
          });
          width = Math.min(width, viewport - 48);
          var left = (viewport - width) / 2;
          var pointer = Math.max(20, Math.min(trigger.left + trigger.width / 2 - left, width - 20));
          panel.style.width = width + 'px';
          panel.style.left = (left - host.left) + 'px';
          panel.style.setProperty('--cra1-nav-pointer', pointer + 'px');
        },
        selectGroup: function (index) { this.cancelGroup(); this.activeGroup = index; },
        queueGroup: function (index, event) {
          if (event.pointerType !== 'mouse') return;
          var self = this;
          this.cancelGroup();
          this._groupTimer = window.setTimeout(function () { self.activeGroup = index; }, 100);
        },
        cancelGroup: function () { window.clearTimeout(this._groupTimer); this._groupTimer = null; },
        moveGroup: function (direction) {
          var links = Array.from(this._root.querySelectorAll('[data-nav-group]'));
          var index = links.indexOf(document.activeElement);
          var next = links[(index + direction + links.length) % links.length];
          if (next) { this.selectGroup(Number(next.dataset.navGroup)); CRA1Shared.UI.focus(next); }
        },
        focusProducts: function () {
          var self = this;
          window.cancelAnimationFrame(this._focusFrame);
          this.$nextTick(function () {
            self._focusFrame = window.requestAnimationFrame(function () {
              if (!self.open) return;
              var section = self._root.querySelector('[data-nav-group-panel="' + self.activeGroup + '"]');
              if (section) CRA1Shared.UI.focus(section.querySelector('[data-nav-product]') || section.querySelector('a[href]'));
            });
          });
        },
        close: function () { this.cancelGroup(); window.cancelAnimationFrame(this._focusFrame); if (this._popover) this._popover.close(); },
        destroy: function () {
          this.cancelGroup();
          window.cancelAnimationFrame(this._focusFrame);
          window.removeEventListener('resize', this._onResize);
          if (this._popover) this._popover.destroy();
        }
      };
    });

    /* One server-rendered mobile tree; deeper branches replace the root view. */
    Alpine.data('mobileNavigation', function () {
      return {
        activeTop: null, inlineTop: null, activeSecond: null, activeThird: null,
        title: '', _root: null, _rootScroll: 0, _returnFocus: null, _onResize: null,
        init: function () {
          var self = this;
          this._root = this.$el;
          this._onResize = function () {
            if (window.innerWidth >= 1024 && self.$store.ui.menuOpen) self.$store.ui.closeMenu();
          };
          window.addEventListener('resize', this._onResize);
          this.$watch('$store.ui.menuOpen', function (open) {
            if (open) {
              self._returnFocus = document.activeElement;
              self.reset();
              self.$nextTick(function () {
                if (self.$store.ui.menuOpen) CRA1Shared.UI.focus(self.$refs.closeButton);
              });
            } else {
              self.reset();
              // A desktop resize hides the mobile trigger; do not focus a hidden node.
              if (self._returnFocus && self._returnFocus.getClientRects().length) CRA1Shared.UI.focus(self._returnFocus);
            }
          });
        },
        reset: function () {
          this.activeTop = this.inlineTop = this.activeSecond = this.activeThird = null;
          this.title = '';
          this._rootScroll = 0;
          if (this.$refs.navScroll) this.$refs.navScroll.scrollTop = 0;
        },
        root: function (id) {
          return this._root.querySelector('[data-drawer-root="' + id + '"]');
        },
        toggleTop: function (id, depth) {
          if (depth <= 2) {
            this.inlineTop = this.inlineTop === id ? null : id;
            return;
          }
          var root = this.root(id), self = this;
          if (!root) return;
          this._rootScroll = this.$refs.navScroll.scrollTop;
          this.inlineTop = null;
          this.activeTop = id;
          this.title = root.dataset.drawerTitle;
          var first = root.querySelector('[data-drawer-second]');
          this.activeSecond = first ? first.dataset.drawerSecond : null;
          this.selectFirstThird(first);
          this.$nextTick(function () {
            self.$refs.navScroll.scrollTop = 0;
            CRA1Shared.UI.focus(self.$refs.backButton);
          });
        },
        selectFirstThird: function (group) {
          var first = group && group.querySelector('[data-drawer-third]');
          this.activeThird = first ? first.dataset.drawerThird : null;
        },
        toggleSecond: function (id) {
          this.activeSecond = this.activeSecond === id ? null : id;
          this.selectFirstThird(this.activeSecond ? this._root.querySelector('[data-drawer-second="' + id + '"]') : null);
        },
        toggleThird: function (id) { this.activeThird = this.activeThird === id ? null : id; },
        back: function () {
          var root = this.root(this.activeTop), scroll = this._rootScroll, self = this;
          this.activeTop = this.activeSecond = this.activeThird = null;
          this.title = '';
          this.$nextTick(function () {
            self.$refs.navScroll.scrollTop = scroll;
            if (root) CRA1Shared.UI.focus(root.querySelector('[data-drawer-trigger]'));
          });
        },
        onKeydown: function (event) {
          if (!this.$store.ui.menuOpen) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (this.activeTop !== null) this.back();
            else this.$store.ui.closeMenu();
            return;
          }
          if (event.key !== 'Tab') return;
          var links = Array.from(this.$refs.drawer.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')).filter(function (node) {
            return node.getClientRects().length && !node.closest('[inert]');
          });
          if (!links.length) return;
          var first = links[0], last = links[links.length - 1], active = document.activeElement;
          if (event.shiftKey && (active === first || !links.includes(active))) {
            event.preventDefault(); CRA1Shared.UI.focus(last);
          } else if (!event.shiftKey && (active === last || !links.includes(active))) {
            event.preventDefault(); CRA1Shared.UI.focus(first);
          }
        },
        destroy: function () { window.removeEventListener('resize', this._onResize); }
      };
    });

    /* ================= 页面组件：顶部信息条（左侧公告轮播） ================= */
    Alpine.data('noticeBar', function () {
      var cloud = window.__CRA1__ || {};
      var items = (Array.isArray(cloud.notice_bar) ? cloud.notice_bar : []).filter(function (n) { return n && n.name; });
      return {
        items: items,
        index: 0,
        timer: null,

        init: function () {
          if (this.items.length < 2) return;
          var self = this;
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          var seconds = Math.max(3, parseInt(cloud.notice_bar_interval, 10) || 5);
          this.timer = setInterval(function () {
            self.index = (self.index + 1) % self.items.length;
          }, seconds * 1000);
          document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
              if (self.timer) { clearInterval(self.timer); self.timer = null; }
            } else if (!self.timer) {
              self.timer = setInterval(function () {
                self.index = (self.index + 1) % self.items.length;
              }, seconds * 1000);
            }
          });
        },
      };
    });

    /* ================= 页面组件：导航下轮播图 ================= */
    Alpine.data('heroCarousel', function () {
      var slides = (window.__CRA1__ && window.__CRA1__.slides) || [];
      var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      var selectedEffect = (window.__CRA1__ && window.__CRA1__.slides_effect) || 'cube';
      var effects = ['fade', 'slide', 'cube', 'flip', 'none'];
      // Keep native Animation/ResizeObserver objects outside Alpine's reactive proxy.
      var animations = [], transitionId = 0, stage = null, media = null, faces = [];
      var resizeObserver = null, mediaWidth = 0, visibilityListener = null, motionListener = null;
      var copy = null, copyParts = [], copyAnimations = [], copyTransitionId = 0, copyWidth = 0;
      var resizeListener = null, viewportWidth = window.innerWidth, destroyed = false;
      return {
        slides: slides,
        index: 0,
        copyIndex: 0,
        copyBusy: false,
        hasActions: slides.some(function (slide) { return slide.btn && (slide.btn_url || slide.url); }),
        timer: null,
        effect: effects.indexOf(selectedEffect) >= 0 ? selectedEffect : 'cube',
        reducedMotion: motion.matches,
        animating: false,
        typeTimer: null,
        typedTitle: '',
        typedDesc: '',

        /** 把 .jpg/.jpeg/.png 映射为同名 .webp（后台字段无需改）；
            没有对应 WebP 时返回空串，<source> 会被浏览器忽略、自动用 <img> 原图。 */
        webpOf: function (src) {
          if (typeof src !== 'string' || !src) return '';
          if (!/\.(jpe?g|png)(\?|$)/i.test(src)) return '';
          return src.replace(/\.(jpe?g|png)(\?|$)/i, '.webp$2');
        },

        init: function () {
          var self = this;
          this.startTyping();
          this.$nextTick(function () {
            if (destroyed) return;
            copy = self.$refs.heroCopy;
            if (copy) {
              copyParts = Array.from(copy.querySelectorAll('[data-hero-copy]'));
              copyWidth = copy.clientWidth;
              self.measureCopy();
              if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(function () { if (!destroyed) self.measureCopy(); });
              }
            }
            media = self.$refs.heroMedia;
            stage = self.$refs.slideStage;
            if (media && stage) {
              faces = Array.from(stage.querySelectorAll('[data-slide-index]'));
              self.settleSlides();
              mediaWidth = media.clientWidth;
            }
            resizeListener = function () {
              var width = media ? media.clientWidth : 0;
              var textWidth = copy ? copy.clientWidth : 0;
              if (width !== mediaWidth || textWidth !== copyWidth || viewportWidth !== window.innerWidth) {
                mediaWidth = width;
                copyWidth = textWidth;
                viewportWidth = window.innerWidth;
                self.settleSlides();
                self.settleCopy();
                self.measureCopy();
              }
            };
            if (window.ResizeObserver) {
              resizeObserver = new ResizeObserver(resizeListener);
              if (media) resizeObserver.observe(media);
              if (copy) resizeObserver.observe(copy);
            }
            window.addEventListener('resize', resizeListener);
          });
          this.play();
          visibilityListener = function () {
            if (document.hidden) {
              self.stop();
              self.settleSlides();
              self.settleCopy();
            } else {
              self.syncVideos();
              self.play();
            }
          };
          document.addEventListener('visibilitychange', visibilityListener);
          motionListener = function (event) {
            self.reducedMotion = event.matches;
            self.settleSlides();
            self.settleCopy();
            self.play();
          };
          if (motion.addEventListener) motion.addEventListener('change', motionListener);
          else motion.addListener(motionListener);
        },
        play: function () {
          this.stop();
          if (this.slides.length < 2 || this.reducedMotion || document.hidden ||
              (this.$el && (this.$el.matches(':hover') || this.$el.contains(document.activeElement)))) return;
          var self = this;
          this.timer = setInterval(function () {
            self.go(self.index + 1);
          }, 6000);
        },
        stop: function () {
          if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
          }
        },
        go: function (i) {
          if (!this.slides.length || !Number.isFinite(Number(i))) return;
          i = Math.trunc(Number(i));
          var next = (i + this.slides.length) % this.slides.length;
          if (next < 0) next += this.slides.length;
          if (next === this.index) return;
          var previous = this.index, direction = i > previous ? 1 : -1;
          this.settleSlides();
          this.index = next;
          this.startTyping();
          this.transitionCopy();
          this.transitionSlides(previous, next, direction);
        },
        /** Reserve each text row using all configured slides, without per-frame layout work. */
        measureCopy: function () {
          if (!copy || !copy.clientWidth || destroyed) return;
          var measure = copy.cloneNode(true);
          Array.from(measure.querySelectorAll('*')).concat([measure]).forEach(function (element) {
            Array.from(element.attributes).forEach(function (attribute) {
              if (/^(x-|:|@)/.test(attribute.name) || attribute.name === 'id') element.removeAttribute(attribute.name);
            });
          });
          measure.classList.add('marketing-hero-copy--measure');
          measure.setAttribute('aria-hidden', 'true');
          measure.setAttribute('inert', '');
          measure.style.width = copy.clientWidth + 'px';
          ['title', 'description', 'action'].forEach(function (part) {
            measure.style.setProperty('--hero-' + part + '-height', '0px');
          });
          var title = measure.querySelector('[data-hero-copy="title"]');
          var description = measure.querySelector('[data-hero-copy="description"]');
          var action = measure.querySelector('[data-hero-copy="action"]');
          if (!title || !description || !action) return;
          var button = action.querySelector('a'), label = button && button.querySelector('span');
          var heights = { title: 0, description: 0, action: 0 };
          copy.parentElement.appendChild(measure);
          try {
            this.slides.forEach(function (slide) {
              title.textContent = slide.title || '';
              description.textContent = slide.desc || '';
              var hasAction = !!(slide.btn && (slide.btn_url || slide.url));
              action.style.display = hasAction ? '' : 'none';
              if (button) button.style.display = '';
              if (label) label.textContent = slide.btn || '';
              heights.title = Math.max(heights.title, title.getBoundingClientRect().height);
              heights.description = Math.max(heights.description, description.getBoundingClientRect().height);
              if (hasAction && button) heights.action = Math.max(heights.action, button.getBoundingClientRect().height);
            });
          } finally { measure.remove(); }
          Object.keys(heights).forEach(function (part) {
            copy.style.setProperty('--hero-' + part + '-height', Math.ceil(heights[part]) + 'px');
          });
          this.hasActions = this.slides.some(function (slide) { return slide.btn && (slide.btn_url || slide.url); });
        },
        settleCopy: function () {
          copyTransitionId++;
          copyAnimations.forEach(function (animation) { animation.cancel(); });
          copyAnimations = [];
          this.copyIndex = this.index;
          this.copyBusy = false;
        },
        transitionCopy: function () {
          if (!copy || !copyParts.length || !copy.animate || this.effect === 'none' || document.hidden) {
            this.settleCopy();
            return;
          }
          var self = this, id = ++copyTransitionId, next = this.index, reduced = this.reducedMotion;
          // Capture an interrupted transition before cancelling it, so rapid clicks do not flash.
          var starts = copyParts.map(function (part) {
            var style = window.getComputedStyle(part);
            return { opacity: style.opacity, transform: style.transform };
          });
          copyAnimations.forEach(function (animation) { animation.cancel(); });
          copyAnimations = [];
          this.copyBusy = true;
          copyParts.forEach(function (part, i) {
            var frames = reduced ? [{ opacity: starts[i].opacity }, { opacity: 0 }] : [
              starts[i], { opacity: 0, transform: 'translateY(-' + [6, 4, 2][i] + 'px)' }
            ];
            copyAnimations.push(part.animate(frames, { duration: reduced ? 70 : 150, easing: 'ease-out', fill: 'both' }));
          });
          var outgoing = copyAnimations.slice();
          Promise.all(outgoing.map(function (animation) { return animation.finished; })).then(function () {
            if (id !== copyTransitionId || destroyed) return;
            // Copy, CTA label and destination change together while the old copy is invisible.
            self.copyIndex = next;
            self.$nextTick(function () {
              if (id !== copyTransitionId || destroyed) return;
              copyAnimations = copyParts.map(function (part, i) {
                var frames = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
                  { opacity: 0, transform: 'translateY(' + [12, 6, 4][i] + 'px)' },
                  { opacity: 1, transform: 'translateY(0)' }
                ];
                return part.animate(frames, {
                  duration: reduced ? 120 : [400, 340, 280][i], delay: reduced ? 0 : i * 60,
                  easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both'
                });
              });
              outgoing.forEach(function (animation) { animation.cancel(); });
              Promise.all(copyAnimations.map(function (animation) { return animation.finished; })).then(function () {
                if (id === copyTransitionId && !destroyed) self.settleCopy();
              }).catch(function () {
                if (id === copyTransitionId && !destroyed) self.settleCopy();
              });
            });
          }).catch(function () {
            if (id === copyTransitionId && !destroyed) self.settleCopy();
          });
        },
        settleSlides: function () {
          transitionId++;
          animations.forEach(function (animation) { animation.cancel(); });
          animations = [];
          this.animating = false;
          if (stage) stage.style.transform = '';
          if (media) media.style.perspective = '';
          var selected = this.index;
          faces.forEach(function (face, i) {
            face.style.display = i === selected ? 'block' : 'none';
            face.style.transform = '';
            face.style.opacity = '';
            face.style.zIndex = '';
          });
          this.syncVideos();
        },
        syncVideos: function () {
          var selected = this.index, reduced = this.reducedMotion;
          faces.forEach(function (face, i) {
            var video = face.querySelector('video');
            if (!video) return;
            if (i !== selected || reduced || document.hidden) video.pause();
            else {
              var playing = video.play();
              if (playing && playing.catch) playing.catch(function () {});
            }
          });
        },
        transitionSlides: function (previous, next, direction) {
          if (!media || !stage || !faces[previous] || !faces[next] ||
              this.reducedMotion || this.effect === 'none' || !stage.animate) {
            this.settleSlides();
            return;
          }
          var self = this, id = transitionId, outgoing = faces[previous], incoming = faces[next];
          var width = media.clientWidth, effect = this.effect;
          if (!width) { this.settleSlides(); return; }
          outgoing.style.display = incoming.style.display = 'block';
          this.animating = true;
          this.syncVideos();
          function animate(element, frames, duration, easing) {
            var animation = element.animate(frames, { duration: duration, easing: easing || 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
            animations.push(animation);
          }
          if (effect === 'cube') {
            // Two adjoining faces form one cube; depth follows the actual image width.
            var depth = width / 2;
            media.style.perspective = Math.max(800, width * 2.4) + 'px';
            outgoing.style.transform = 'translateZ(' + depth + 'px)';
            incoming.style.transform = 'rotateY(' + (direction * 90) + 'deg) translateZ(' + depth + 'px)';
            animate(stage, [
              { transform: 'translateZ(-' + depth + 'px) rotateY(0deg)' },
              { transform: 'translateZ(-' + depth + 'px) rotateY(' + (-direction * 90) + 'deg)' }
            ], 680, 'cubic-bezier(.65, 0, .35, 1)');
          } else if (effect === 'flip') {
            media.style.perspective = Math.max(800, width * 2.4) + 'px';
            incoming.style.transform = 'rotateY(' + (direction * 180) + 'deg)';
            animate(stage, [
              { transform: 'rotateY(0deg)' },
              { transform: 'rotateY(' + (-direction * 180) + 'deg)' }
            ], 560, 'cubic-bezier(.65, 0, .35, 1)');
          } else if (effect === 'slide') {
            animate(outgoing, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-direction * 100) + '%)' }], 480);
            animate(incoming, [{ transform: 'translateX(' + (direction * 100) + '%)' }, { transform: 'translateX(0)' }], 480);
          } else {
            // Blend above an opaque outgoing frame, then feather the combined surface.
            // Fading both layers would briefly expose the fog between photographs.
            incoming.style.zIndex = '1';
            animate(incoming, [{ opacity: 0 }, { opacity: 1 }], 550, 'cubic-bezier(.4, 0, .2, 1)');
          }
          Promise.all(animations.map(function (animation) { return animation.finished; })).then(function () {
            if (id === transitionId) self.settleSlides();
          }).catch(function () {
            // Interrupted navigation/resize settles the latest selected slide immediately.
            if (id === transitionId) self.settleSlides();
          });
        },
        destroy: function () {
          destroyed = true;
          this.stop();
          if (this.typeTimer) clearInterval(this.typeTimer);
          this.settleSlides();
          this.settleCopy();
          faces.forEach(function (face) { var video = face.querySelector('video'); if (video) video.pause(); });
          if (resizeObserver) resizeObserver.disconnect();
          if (resizeListener) window.removeEventListener('resize', resizeListener);
          if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener);
          if (motionListener) {
            if (motion.removeEventListener) motion.removeEventListener('change', motionListener);
            else motion.removeListener(motionListener);
          }
        },
        /** 激活标题在切换条内水平居中：只调整容器 scrollLeft，绝不滚动页面（修复滑到底部后被拉回顶部的问题）。
            用 scrollTo + behavior:'smooth' 与 .scrollRail 保持一致：此前是瞬时赋值，
            自动轮播每 6s 就把切换条"啪"地挪一次，与轮播本身的 500ms 淡入不同步。 */
        centerTab: function (el) {
          if (!el || !el.parentElement) return;
          var wrap = el.parentElement;
          var target = el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2;
          if (Math.abs(wrap.scrollLeft - target) > 1) {
            if (wrap.scrollTo) wrap.scrollTo({ left: target, behavior: this.reducedMotion ? 'instant' : 'smooth' });
            else wrap.scrollLeft = target;
          }
        },
        /** 打字机效果：切换时逐字输出标题与描述，而不是整块重载 */
        startTyping: function () {
          var self = this;
          var s = this.slides[this.index] || {};
          var title = s.title || '';
          var desc = s.desc || '';
          if (this.typeTimer) { clearInterval(this.typeTimer); this.typeTimer = null; }
          if (this.reducedMotion || (this.$el && this.$el.dataset.heroMode === 'editorial')) {
            this.typedTitle = title;
            this.typedDesc = desc;
            return;
          }
          var step = 0;
          var total = Math.max(title.length, desc.length + 3);
          this.typedTitle = '';
          this.typedDesc = '';
          this.typeTimer = setInterval(function () {
            step++;
            self.typedTitle = title.slice(0, step);
            self.typedDesc = desc.slice(0, Math.max(0, step - 3));
            if (step >= total) {
              clearInterval(self.typeTimer);
              self.typeTimer = null;
              self.typedTitle = title;
              self.typedDesc = desc;
            }
          }, 55);
        },
        current: function () {
          return this.slides[this.index] || {};
        },
        copyCurrent: function () {
          return this.slides[this.copyIndex] || {};
        },
        isVideo: function (s) {
          return /\.(mp4|webm)(\?|#|$)/i.test((s && s.img) || '');
        },
      };
    });

        /* ================= 全局 store：site（官网公共数据） ================= */
    Alpine.store('site', {
      loaded: false,
      common: null,

      /** 后台未配置 $data 时，用 /console/v1/common 填充页脚等公共数据 */
      loadCommon: function () {
        if (this.loaded) return Promise.resolve();
        var self = this;
        return Promise.resolve(window.__CRA1_RUNTIME__?.common || {})
          .then(function (data) {
            self.common = data || null;
          })
          .catch(function () {
            self.common = null;
          })
          .then(function () {
            self.loaded = true;
          });
      },

      /** 从 common 数据中取值（支持点路径） */
      pick: function (path, fallback) {
        var value = this.common;
        if (!value) return fallback;
        var keys = (path || '').split('.');
        for (var i = 0; i < keys.length; i++) {
          if (value === null || typeof value[keys[i]] === 'undefined') return fallback;
          value = value[keys[i]];
        }
        return value === '' || value === null ? fallback : value;
      },

      termsServiceUrl: function () {
        return this.pick('terms_service_url', '/agreement.htm?id=2');
      },
      termsPrivacyUrl: function () {
        return this.pick('terms_privacy_url', '/agreement.htm?id=1');
      },
    });

    /* Alpine adapters: all interaction and search rendering lives in CRA1Shared. */
    Alpine.data('headerSupport', function () {
      return {
        _component:null,
        init: function () {
          var self=this;
          this.$nextTick(function () {
            var config={};try{config=JSON.parse(self.$el.dataset.support||'{}');}catch(e){}
            self._component=CRA1Shared.HeaderActions.mountSupport(self.$el,{config:config,beforeOpen:function(){self.$dispatch('cra1-site-search-close');self.$store.ui.closeMenu();}});
          });
          this.$watch('$store.ui.menuOpen',function(open){if(open&&self._component)self._component.close();});
        },
        close:function(restore){if(this._component)this._component.close(restore);},
        destroy:function(){if(this._component)this._component.destroy();}
      };
    });
    Alpine.data('headerAccount', function () {
      return {
        _component:null,
        upOpen:false,
        init:function(){
          var self=this;
          this.$nextTick(function(){
            self._component=CRA1Shared.HeaderActions.mountAccount(self.$el,{
              getUser:function(){return self.$store.auth.user;},
              labels:{basic:self.$el.dataset.basic,accountSecurity:self.$el.dataset.accountSecurity,security:self.$el.dataset.security,finance:self.$el.dataset.finance},
              onLogout:function(){return self.$store.auth.logout();},
              beforeOpen:function(){self.$dispatch('cra1-site-search-close');self.$store.ui.closeMenu();},
              onOpenChange:function(value){self.upOpen=value;}
            });
          });
          this.$watch('$store.auth.user',function(){if(self._component)self._component.update();});
          this.$watch('$store.ui.menuOpen',function(open){if(open&&self._component)self._component.close();});
        },
        destroy:function(){if(this._component)this._component.destroy();}
      };
    });
    window.addEventListener('cra1:avatar-updated',function(e){
      var auth=Alpine.store('auth');
      if(auth.user&&String(auth.user.id)===String(e.detail.id))auth.user=Object.assign({},auth.user,{theme_avatar:e.detail.theme_avatar});
    });
    window.addEventListener('cra1:avatar-refresh',function(e){
      var auth=Alpine.store('auth');
      if(auth.user&&String(auth.user.id)===String(e.detail.id))auth.check();
    });
    Alpine.data('searchBox', function () {
      return {
        _component:null,
        // Initial values let a cached previous header initialize before it is mounted.
        open: false, keyword: '', groups: [], errors: [], loading: false, activeIndex: -1,
        get showResults() { return false; }, get resultCount() { return 0; },
        init: function () {
          var self = this;
          this.$nextTick(function () {
            self._component = CRA1Shared.HeaderSearch.mount(self.$el, {
              idPrefix: 'cra1-site-search',
              copy: { placeholder: self.$el.dataset.placeholder, searching: self.$el.dataset.searching, noresult: self.$el.dataset.noresult },
              getSearchOptions: function () { return { includeHosts: self.$store.auth.loggedIn, context: 'website' }; },
              beforeOpen: function () { self.$store.ui.closeMenu(); },
              onOpenChange: function (open) { self.open = open; self.$dispatch('cra1-site-search', { open: open }); }
            });
          });
          this.$watch('$store.auth.loggedIn', function () { if (self._component) self._component.refresh(); });
        },
        close: function (restore) { if (this._component) this._component.close(restore); },
        onFocusout: function () { /* Handled by the common popover. */ },
        destroy: function () { if (this._component) this._component.destroy(); }
      };
    });

    /* ================= 页面组件：首页 ================= */
    Alpine.data('home', function () {
      return {
        loadingNotices: true,
        loadingNews: true,
        notices: [],
        news: [],
        loadingProducts: true,
        products: [],
        allConfigured: null,
        productGroups: [],
        activeGroup: 0,
        /* 手机端产品截断：默认显示 3 个，超出隐藏；点「加载更多」全部展开 */
        productMobileLimit: (function () {
          var n = parseInt((window.__CRA1__ || {}).home_products_mobile_limit, 10);
          if (!n || n < 1) n = 3;
          return Math.min(n, 12);
        })(),
        mobileProductsAll: false,
        slides: [],
        slideIndex: 0,
        slideTimer: null,

        init: function () {
          var cloud = window.__CRA1__ || {};
          // 模块关闭时不再发起对应请求（开关同时控制服务端渲染）
          if (String(cloud.show_news) === '1') this.loadNews();
          if (String(cloud.show_pricing) === '1') this.loadProducts();
        },

        productLimit: function () {
          var limit = parseInt((window.__CRA1__ || {}).home_products_limit, 10);
          if (!limit || limit < 1) limit = 8;
          return Math.min(limit, 12);
        },

        initSlides: function () {
          var serverSlides = window.__PAGE_DATA__ && window.__PAGE_DATA__.banner;
          if (serverSlides && serverSlides.length) {
            this.slides = serverSlides;
          } else {
            // 没有后台 Banner 时保留静态 Hero，避免用占位轮播覆盖可索引内容。
            this.slides = [];
          }
          this.startSlide();
        },
        startSlide: function () {
          var self = this;
          if (this.slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          this.stopSlide();
          this.slideTimer = setInterval(function () {
            self.slideIndex = (self.slideIndex + 1) % self.slides.length;
          }, 5000);
        },
        stopSlide: function () {
          if (this.slideTimer) {
            clearInterval(this.slideTimer);
            this.slideTimer = null;
          }
        },
        productUrl: function (p) {
          return p && p.id ? '/cart/goodsList.htm?product_id=' + encodeURIComponent(p.id) : '/cart/goodsList.htm';
        },
        // Catalogue descriptions may be rich HTML. Cards render inert plain text only.
        productDescription: function (p) {
          var text = p && p.description ? String(p.description) : '';
          if (!text) return '';
          var fragment = document.createElement('template');
          fragment.innerHTML = text;
          fragment.content.querySelectorAll('script, style, noscript, template, iframe, object').forEach(function (node) { node.remove(); });
          return (fragment.content.textContent || '').replace(/\s+/g, ' ').trim();
        },

        productSpecs: function (p) {
          if (!p) return [];
          var specs = [];
          [['CPU','cpu'],['内存','memory'],['存储','disk'],['带宽','bandwidth']].forEach(function (pair) {
            var value = p[pair[1]];
            if (typeof value === 'string' && value.trim()) specs.push(pair[0] + ' · ' + value.trim());
          });
          if (!specs.length && p.description) {
            var fragment = document.createElement('template'); fragment.innerHTML = String(p.description);
            fragment.content.querySelectorAll('script,style,noscript,iframe,object').forEach(function (node) { node.remove(); });
            var lines = Array.from(fragment.content.querySelectorAll('li,p,tr')).map(function (node) { return (node.textContent || '').replace(/\s+/g,' ').trim(); });
            specs = lines.filter(function (line) { return /(?:CPU|内存|带宽|硬盘|存储|流量|核|\bRAM\b)/i.test(line) && line.length <= 70; });
          }
          return specs.slice(0, 3);
        },
        toggleProducts: function () {
          this.mobileProductsAll = !this.mobileProductsAll;
          if (this.mobileProductsAll) this.$nextTick(() => this.animateProducts());
          else this.$refs.productGrid.scrollIntoView({block:'start',behavior:'instant'});
        },

        loadNews: function () {
          var self = this;
          API.get('/announcement', { page: 1, limit: 6 })
            .then(function (data) {
              self.notices = self.pickList(data).slice(0, 6);
            })
            .catch(function () {
              self.notices = [];
            })
            .then(function () {
              self.loadingNotices = false;
            });
          API.get('/news', { page: 1, limit: 6 })
            .then(function (data) {
              self.news = self.pickList(data).slice(0, 6);
            })
            .catch(function () {
              self.news = [];
            })
            .then(function () {
              self.loadingNews = false;
            });
        },

        /* 指定商品模式：按当前筛选分组过滤（activeGroup=0 为全部），再截取显示上限 */
        sliceByGroup: function (list, limit) {
          var g = this.activeGroup || 0;
          var out = g ? list.filter(function (p) { return p.__group === g; }) : list.slice();
          return out.slice(0, limit);
        },

        loadProducts: function () {
          var self = this;
          var cloud = window.__CRA1__ || {};
          var limit = this.productLimit();
          var configured = Array.isArray(cloud.home_products) ? cloud.home_products : [];
          if (configured.length) {
            // 后台指定商品：一次拉取商品列表后按配置顺序与标签组装，仍展示实时价格。
            // v2.33 起配置为树形（二级分组 + 商品）：分组即前台的筛选条，
            // 每个商品记住所属分组，切换筛选时按分组过滤。
            this.loadingProducts = true;
            this.activeGroup = 0;
            // 筛选条：无分组时（旧格式）不显示，行为与改造前一致
            var configuredGroups = Array.isArray(cloud.home_product_groups) ? cloud.home_product_groups : [];
            this.productGroups = configuredGroups.map(function (name, i) {
              return { id: i + 1, name: name };
            });
            (async function () {
              var found = {}, page = 1, seen = {};
              while (true) {
                var data = await API.get('/product', {page:page,limit:100});
                var list = self.pickList(data), added = 0;
                list.forEach(function(p) { if(p && p.id !== undefined && !seen[String(p.id)]) {seen[String(p.id)]=true;found[String(p.id)]=p;added++;} });
                if (configured.every(function(c){return !!found[String(c.id)];}) || !added || !list.length || (Number(data.count || data.total)>0 && Object.keys(seen).length>=Number(data.count || data.total))) break;
                page++;
              }
              return found;
            })()
              .then(function (byId) {
                var picked = [];
                configured.forEach(function (c) {
                  var p = byId[String(c.id)];
                  if (p) {
                    if (c.tag) p.tag = c.tag;
                    // 模块内自定义描述（后台商品行「编辑描述」）优先于 v10 商品描述；
                    // 留空时不动 p.description，保持接口返回的系统描述。
                    if (c.desc) p.description = c.desc;
                    // 分组序号（1 起）与筛选条对应；无分组为 0
                    p.__group = c.group ? configuredGroups.indexOf(c.group) + 1 : 0;
                    picked.push(p);
                  }
                });
                self.allConfigured = picked;
                self.products = self.sliceByGroup(picked, limit);
                self.animateProducts();
              })
              .catch(function () {
                self.products = [];
              })
              .then(function () {
                self.loadingProducts = false;
              });
            return;
          }
          // tabs 用二级分组（商品列表接口的 id 参数即二级分组 ID，一级分组无法直接过滤）
          API.get('/product/group/second')
            .then(function (data) {
              self.productGroups = self.pickList(data).slice(0, 6);
            })
            .catch(function () {
              self.productGroups = [];
            });
          this.fetchProducts(parseInt(cloud.home_products_group, 10) || 0);
        },
        fetchProducts: function (groupId) {
          var self = this;
          var cloud = window.__CRA1__ || {};
          var configured = Array.isArray(cloud.home_products) ? cloud.home_products : [];
          this.activeGroup = groupId || 0;
          this.mobileProductsAll = false;
          if (configured.length && Array.isArray(self.allConfigured)) {
            // 指定商品模式：不重新拉接口，仅按分组过滤已组装的清单
            this.products = this.sliceByGroup(self.allConfigured, this.productLimit());
            this.animateProducts();
            return;
          }
          var request = this._productRequest = (this._productRequest || 0) + 1;
          this.loadingProducts = true;
          this.mobileProductsAll = false; // 切换分组后手机端重新收起
          var params = { page: 1, limit: this.productLimit() };
          if (groupId) params.id = groupId;
          API.get('/product', params)
            .then(function (data) {
              if (request !== self._productRequest) return;
              self.products = self.pickList(data).slice(0, self.productLimit());
              self.animateProducts();
            })
            .catch(function () {
              if (request === self._productRequest) self.products = [];
            })
            .then(function () {
              if (request === self._productRequest) self.loadingProducts = false;
            });
        },

        /** 分组切换 / 首次加载后，让新渲染的产品卡错落入场。
            节点由 x-for 重建，插进 DOM 时已是终态，没有过渡起点，
            因此必须显式播一次入场动画——否则"点分组 → 卡片啪地全换"。 */
        animateProducts: function () {
          if (typeof window.cra1AnimateListIn === 'function') {
            window.cra1AnimateListIn(this.$refs.productGrid, '[data-enter-item]');
          }
        },

        pickList: function (data) {
          if (!data) return [];
          if (data.list && data.list.length !== undefined) return data.list;
          if (Array.isArray(data)) return data;
          return [];
        },
        priceText: function (p) {
          if (!p) return '';
          if (p.pay_type === 'free') return '免费';
          if (!p.price && p.price !== 0) return '价格咨询';
          var digits = Math.max(2, Math.min(4, (String(p.price).split('.')[1] || '').length));
          return CRA1Shared.Runtime.money(p.price, digits) + (p.cycle ? ' / ' + p.cycle : '');
        },
        timeText: function (t) {
          if (!t) return '';
          var d = new Date(t * 1000);
          var pad = function (n) {
            return (n < 10 ? '0' : '') + n;
          };
          return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        },
      };
    });

    /* ================= 页面组件：列表页（新闻/公告/分类） ================= */
    Alpine.data('contentList', function () {
      return {
        loading: true,
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        endpoint: '/news',
        extraParams: {},

        /** endpoint: 接口；extraParams: 附加查询参数（如分类 id） */
        initEndpoint: function (endpoint, extraParams) {
          this.endpoint = endpoint || '/news';
          this.extraParams = extraParams || {};
          this.load();
        },
        load: function () {
          var self = this;
          this.loading = true;
          var params = { page: this.page, limit: this.limit };
          Object.keys(this.extraParams).forEach(function (k) {
            if (self.extraParams[k]) params[k] = self.extraParams[k];
          });
          API.get(this.endpoint, params)
            .then(function (data) {
              self.items = (data && data.list) || [];
              self.total = (data && data.count) || self.items.length;
              self.animateItems();
            })
            .catch(function () {
              self.items = [];
              self.total = 0;
            })
            .then(function () {
              self.loading = false;
            });
        },
        /** 翻页/首次加载后，新列表项错落入场（此前翻页是整块瞬换，无任何过渡） */
        animateItems: function () {
          if (typeof window.cra1AnimateListIn !== 'function') return;
          var self = this;
          this.$nextTick(function () {
            window.cra1AnimateListIn(self.$refs.listBody, '[data-enter-item]');
          });
        },
        prev: function () {
          if (this.page > 1) {
            this.page--;
            this.load();
          }
        },
        next: function () {
          if (this.page * this.limit < this.total) {
            this.page++;
            this.load();
          }
        },
        timeText: function (t) {
          if (!t) return '';
          var d = new Date(t * 1000);
          var pad = function (n) {
            return (n < 10 ? '0' : '') + n;
          };
          return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        },
      };
    });

    /* ================= 页面组件：详情页（新闻/公告/文档） ================= */
    Alpine.data('contentDetail', function () {
      return {
        loading: true,
        notFound: false,
        item: null,
        previous: null,
        next: null,
        detailSuffix: '-详情',
        siteName: '',

        initEndpoint: function (endpoint, detailSuffix) {
          var self = this;
          this.detailSuffix = detailSuffix ? '-' + detailSuffix : '-详情';
          try {
            var cfg = (window.__PAGE_DATA__ && window.__PAGE_DATA__.config) || {};
            self.siteName = (window.__CRA1_SITE_NAME__ || cfg.website_name || '');
          } catch (e) { /* 忽略：无站点名时回退默认后缀 */ }
          // 服务端已按页给出 SEO 标题（如「新闻详情-站点名」），作为动态标题的兜底与后半段：
          // 取到正文标题时拼成「正文标题-页面名-站点名」，取不到时保持服务端标题不动。
          self.baseTitle = document.title || '';
          var id = this.queryId();
          if (!id) {
            this.notFound = true;
            this.loading = false;
            return;
          }
          API.get(endpoint + '/' + id)
            .then(function (data) {
              var item = data && (data.news || data.announcement || data.help || data);
              // Missing or hidden records are returned as an empty object.
              self.item = item && Number(item.id) > 0 ? item : null;
              self.notFound = !self.item;
              self.previous = self.item && Number(self.item.prev?.id)>0 ? self.item.prev : null;
              self.next = self.item && Number(self.item.next?.id)>0 ? self.item.next : null;
              // 只有确实取到标题才改写；否则保持服务端标题
              //（此前无条件写入，id 非法时会得到「详情-新闻详情-站点名」这种半截标题）
              if (self.item && self.item.title) {
                document.title = self.item.title + (self.detailSuffix || '-详情')
                  + (self.siteName ? '-' + self.siteName : '');
              }
            })
            .catch(function () { self.item = null; self.notFound = true; })
            .then(function () { self.loading = false; });
        },
        queryId: function () {
          var m = window.location.search.match(/[?&]id=(\d+)/);
          return m ? m[1] : '';
        },
        timeText: function (t) {
          if (!t) return '';
          var d = new Date(t * 1000);
          var pad = function (n) {
            return (n < 10 ? '0' : '') + n;
          };
          return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        },
        prepareReading: function () {
          var article = this.$root.querySelector('[data-reading-article]'), content = article && article.querySelector('.reading-content');
          if (!content || !this.item || content.dataset.preparedId === String(this.item.id)) return;
          content.dataset.preparedId = this.item.id;
          content.querySelectorAll('p').forEach(function (p) { if (!p.textContent.trim() && !p.querySelector('img,iframe,video,code,table')) p.classList.add('reading-blank'); });
          var headings = Array.from(content.querySelectorAll('h1,h2,h3,h4')).filter(function (heading) { return heading.textContent.trim(); });
          var prior = article.querySelector('.reading-toc'); if (prior) prior.remove();
          if (headings.length >= 3 && content.textContent.length >= 600) {
            var toc = document.createElement('details'); toc.className = 'reading-toc'; toc.open = window.innerWidth >= 768;
            var summary = document.createElement('summary'); summary.textContent = '本文目录'; toc.appendChild(summary);
            var list = document.createElement('ol');
            headings.forEach(function (heading, index) {
              heading.id = 'reading-section-' + index;
              var li = document.createElement('li'), link = document.createElement('a'); link.href = '#' + heading.id; link.textContent = heading.textContent.trim(); li.appendChild(link); list.appendChild(li);
            }); toc.appendChild(list); content.before(toc);
          }
          content.querySelectorAll('img').forEach(function (img) {
            if (img.closest('a')) return;
            var enable = function () {
              if (img.naturalWidth < 120 || img.dataset.zoomReady) return;
              img.dataset.zoomReady = '1';
              var button = document.createElement('button'); button.type = 'button'; button.className = 'reading-image-button'; button.setAttribute('aria-label', '放大查看图片' + (img.alt ? '：'+img.alt : ''));
              img.before(button); button.appendChild(img);
              button.addEventListener('click',function () { showReadingImage(img,button); });
            };
            if (img.complete) enable(); else img.addEventListener('load',enable,{once:true});
          });
        },

        /** 附件兼容：数组、JSON 字符串或逗号分隔字符串 */
        attachments: function (item) {
          if (!item || !item.attachment) return [];
          if (Array.isArray(item.attachment)) return item.attachment;
          if (typeof item.attachment === 'string') {
            if (item.attachment.charAt(0) === '[') {
              try { return JSON.parse(item.attachment) || []; } catch (e) {}
            }
            return item.attachment
              .split(',')
              .map(function (url) { return url.trim(); })
              .filter(Boolean)
              .map(function (url) { return { url: url, name: url.split('/').pop() || '附件' }; });
          }
          return [];
        },
        attachmentUrl: function (file) {
          if (typeof file === 'string') return file;
          return file && (file.url || file.path || file.file) || '';
        },
        attachmentName: function (file) {
          if (typeof file === 'string') return file.split('/').pop() || '附件';
          return file && (file.name || file.filename || file.title) || '附件';
        },
      };
    });

    /* ================= 页面组件：文档中心 ================= */
    Alpine.data('helpCenter', function () {
      return {
        loading: true, groups: [], keyword: '', searchedKeyword: '', activeGroup: '', loadFailed: false, composing: false,
        init: function () {
          this.keyword = new URLSearchParams(window.location.search).get('keywords') || ''; this.load();
        },
        load: function () {
          var self = this, keyword = this.keyword.trim(), request = this._request = (this._request || 0) + 1;
          this.loading = true; this.loadFailed = false;
          API.get('/help', keyword ? {keywords:keyword} : {})
            .then(function (data) {
              if (request !== self._request) return;
              var term = keyword.toLocaleLowerCase();
              self.groups = ((data && data.list) || []).map(function (group) {
                var rows = (group.helps || []).filter(function (row) { return !term || row.search === true || String(row.title || '').toLocaleLowerCase().includes(term); });
                rows = rows.map(function (row, index) { return {row:row,index:index,rank:CRA1Shared.HeaderSearch.titleRank(row.title,keyword)}; }).sort(function (a,b) { return b.rank-a.rank || a.index-b.index; }).map(function (entry) { return entry.row; });
                return Object.assign({},group,{helps:rows});
              }).filter(function (group) { return group.helps.length; });
              if (keyword) self.groups.sort(function (a,b) { var rank = function (group) { return Math.max.apply(null,group.helps.map(function (row) { return CRA1Shared.HeaderSearch.titleRank(row.title,keyword); })); }; return rank(b)-rank(a); });
              self.searchedKeyword = keyword;
              var initial = self.groups.find(function (group) { return /入门|注册|产品|使用/.test(group.name); }) || self.groups[0];
              self.activeGroup = keyword ? '' : (initial ? String(initial.id) : '');
            })
            .catch(function () { if (request === self._request) { self.loadFailed = true; self.groups = []; } })
            .then(function () { if (request === self._request) self.loading = false; });
        },
        search: function () {
          if (this.composing) return; this.load();
          var url = new URL(window.location.href); if (this.keyword.trim()) url.searchParams.set('keywords',this.keyword.trim()); else url.searchParams.delete('keywords'); history.replaceState(null,'',url.pathname+url.search+url.hash);
        },
        resultCount: function () { return this.groups.reduce(function (total,group) { return total+(group.helps||[]).length; },0); },
        titleParts: function (title) { return CRA1Shared.HeaderSearch.titleParts(title,this.searchedKeyword); }
      };
    });

    /* ================= 页面组件：意见反馈表单 ================= */
    Alpine.data('feedbackForm', function () {
      return {
        form: { type: '', title: '', description: '', contact: '' },
        submitting: false,
        done: false,
        errorMsg: '',

        submit: function () {
          var self = this;
          this.errorMsg = '';
          if (!this.form.type) {
            this.errorMsg = '请选择反馈类型';
            return;
          }
          if (!this.form.title) {
            this.errorMsg = '请填写反馈标题';
            return;
          }
          if (!this.form.description) {
            this.errorMsg = '请填写反馈内容';
            return;
          }
          this.submitting = true;
          API.post('/feedback', {
            type: Number(this.form.type),
            title: this.form.title,
            description: this.form.description,
            contact: this.form.contact,
          })
            .then(function () {
              self.done = true;
            })
            .catch(function (err) {
              self.errorMsg = (err && err.msg) || '提交失败，请稍后重试';
            })
            .then(function () {
              self.submitting = false;
            });
        },
      };
    });

    /* ================= 页面组件：联系/咨询表单 ================= */
    Alpine.data('consultForm', function () {
      return {
        form: { contact: '', company: '', phone: '', email: '', matter: '' },
        submitting: false,
        done: false,
        errorMsg: '',

        submit: function () {
          var self = this;
          this.errorMsg = '';
          if (!this.form.contact) {
            this.errorMsg = '请填写联系人';
            return;
          }
          if (!this.form.phone && !this.form.email) {
            this.errorMsg = '手机号与邮箱至少填写一项';
            return;
          }
          if (!this.form.matter) {
            this.errorMsg = '请简单描述您想咨询的产品或问题';
            return;
          }
          this.submitting = true;
          API.post('/consult', this.form)
            .then(function () {
              self.done = true;
            })
            .catch(function (err) {
              self.errorMsg = (err && err.msg) || '提交失败，请稍后重试';
            })
            .then(function () {
              self.submitting = false;
            });
        },
      };
    });
    /* ================= 页面组件：右侧悬浮按钮组（配置驱动） ================= */
    Alpine.data('floatButtons', function () {
      var cloud = window.__CRA1__ || {};
      var items = Array.isArray(cloud.float_items) ? cloud.float_items : [];
      var icons = {
        kefu: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z',
        phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
        qq: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
        wechat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
        link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
      };
      return {
        showTop: false,
        expanded: false,
        items: items,
        init: function () {
          var self = this;
          this.onScroll = function () {
            self.showTop = window.scrollY > 600;
          };
          window.addEventListener('scroll', this.onScroll, { passive: true });
          this.onScroll();
        },
        destroy: function () {
          window.removeEventListener('scroll', this.onScroll);
        },
        iconPath: function (icon) {
          return icons[icon] || icons.link;
        },
        isExternal: function (url) {
          return /^https?:\/\//i.test(url || '');
        },
      };
    });

    /* 可切换面板台（布局 R）：左列选项卡 + 右侧详情面板。
       与具体页面数据无关，仅维护当前选中项下标。 */
    Alpine.data('switchDeck', function () {
      return {
        active: 0,
        init: function () {
          var self = this;
          this._key = function (event) {
            var tabs = Array.from(self.$el.querySelectorAll('[role="tab"]')), current = tabs.indexOf(event.target);
            if (current < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
            event.preventDefault();
            var next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
            self.active = next; tabs[next].focus({preventScroll:true}); tabs[next].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
          };
          this.$el.addEventListener('keydown',this._key);
        },
        destroy: function () { this.$el.removeEventListener('keydown',this._key); }
      };
    });

    /* 横滑轨（布局 E / 首页方案轨 / 首页步骤轨）：左右按钮 + 位置圆点。
       此前这三条轨只能靠手指滑动，用户看不出右边还有内容，键盘也无法横向滚动。
       控件只在 <md 显示（md 起容器变 grid，见各自模板的 md:hidden / md:grid）。

       用 scrollBy({behavior:'smooth'}) 而不是自己算 animation：
       平滑滚动由浏览器合成器处理，不占主线程，也不受 §7.5.3「只动画 transform/opacity」约束
       （scroll 不是 CSS 属性动画）。reduced-motion 时浏览器自动改为瞬时跳转。 */
    Alpine.data('scrollRail', function () {
      return {
        atStart: true,
        atEnd: false,
        pageCount: 1,
        pageIndex: 0,
        _onScroll: null,

        init: function () {
          var self = this;
          var el = this.$refs.rail;
          if (!el) return;
          this._onScroll = function () { self.sync(); };
          el.addEventListener('scroll', this._onScroll, { passive: true });
          window.addEventListener('resize', this._onScroll);
          // 等图片与字体就位后再量一次，避免首次测量偏大
          this.sync();
          setTimeout(function () { self.sync(); }, 400);
        },

        destroy: function () {
          var el = this.$refs.rail;
          if (el && this._onScroll) el.removeEventListener('scroll', this._onScroll);
          if (this._onScroll) window.removeEventListener('resize', this._onScroll);
        },

        /** 同步按钮可用态与圆点位置（按「一屏宽」分页，与 scrollBy 的步长一致） */
        sync: function () {
          var el = this.$refs.rail;
          if (!el) return;
          var max = el.scrollWidth - el.clientWidth;
          var x = el.scrollLeft;
          this.atStart = x <= 2;
          this.atEnd = x >= max - 2;
          var pages = max > 4 ? Math.ceil(el.scrollWidth / Math.max(el.clientWidth, 1)) : 1;
          this.pageCount = Math.max(1, pages);
          var ratio = max > 4 ? x / max : 0;
          this.pageIndex = Math.round(ratio * (this.pageCount - 1));
        },

        step: function (dir) {
          var el = this.$refs.rail;
          if (!el) return;
          el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
        },

        goPage: function (i) {
          var el = this.$refs.rail;
          if (!el) return;
          var max = el.scrollWidth - el.clientWidth;
          var denom = Math.max(this.pageCount - 1, 1);
          el.scrollBy({ left: (i / denom) * max - el.scrollLeft, behavior: 'smooth' });
        },
      };
    });

    /* 长列表展开 / 收起：条目数 > 6 时折叠前 6 条，其余加 .is-collapsed 隐藏。
       折叠在**客户端**做而不是服务端：服务端渲染全部条目，
       即使 JS 失效内容也完整可读（§7.5.10「JS 不可用时不得隐藏内容」）。
       展开时给新出现的项补一次入场动画，避免"啪"地全出现。

       只统计带 data-expand-item 的子元素：容器里通常还有折叠按钮、空态提示等，
       若直接取全部子元素会把这些也算进行数，阈值判断随之失真。 */
    Alpine.data('expandable', function (desktopLimit, mobileLimit) {
      return {
        expanded: false,
        collapsed: false,
        hiddenCount: 0,
        limit: 6,

        init: function () {
          var self = this; this._media = window.matchMedia('(max-width: 767px)');
          this._refresh = function () {
            self.limit = self._media.matches ? (mobileLimit || desktopLimit || 6) : (desktopLimit || 6);
            self.collapsed = self.items().length > self.limit;
            self.hiddenCount = Math.max(0, self.items().length - self.limit); self.apply();
          };
          this._media.addEventListener('change', this._refresh); this._refresh();
        },
        destroy: function () { this._media.removeEventListener('change', this._refresh); },

        items: function () {
          var root = this.$refs.list;
          if (!root) return [];
          return Array.prototype.slice.call(root.querySelectorAll('[data-expand-item]'));
        },

        toggle: function () {
          this.expanded = !this.expanded;
          this.apply();
          if (!this.expanded) { this.$refs.list.scrollIntoView({block:'start',behavior:'instant'}); return; }
          // 展开后给刚出现的项补入场（第二次展开会重播，因为下面先移除了类）
          this.items().slice(this.limit).forEach(function (el, i) {
            el.classList.remove('list-expand-in');
            el.style.animationDelay = Math.min(i * 40, 200) + 'ms';
            void el.offsetWidth;   // 强制重排：同一元素重复加同名类不会重播动画
            el.classList.add('list-expand-in');
          });
        },

        apply: function () {
          var items = this.items();
          var self = this;
          items.forEach(function (el, i) {
            if (i < self.limit || self.expanded) {
              el.classList.remove('is-collapsed');
            } else {
              el.classList.add('is-collapsed');
            }
          });
        },

        label: function () {
          return this.expanded ? '收起' : '展开其余 ' + this.hiddenCount + ' 条';
        },
      };
    });
  });

  function showReadingImage(source, trigger) {
    var dialog = document.createElement('dialog'); dialog.className = 'reading-lightbox';
    var bar = document.createElement('div'); bar.className = 'reading-lightbox-bar';
    var hint = document.createElement('span'); hint.textContent = '点击图片查看原始尺寸';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'cui-button cui-button--outline'; close.textContent = '关闭'; close.addEventListener('click',function () { dialog.close(); });
    bar.append(hint,close); var canvas = document.createElement('div'); canvas.className = 'reading-lightbox-canvas';
    var image = document.createElement('img'); image.src = source.currentSrc || source.src; image.alt = source.alt || '文章图片'; image.addEventListener('click',function () { image.classList.toggle('is-original'); }); canvas.appendChild(image); dialog.append(bar,canvas); document.body.appendChild(dialog);
    dialog.addEventListener('close',function () { dialog.remove(); trigger.focus({preventScroll:true}); });
    dialog.addEventListener('click',function (event) { if (event.target === dialog) dialog.close(); }); dialog.showModal(); close.focus();
  }

  function setupPresentation() {
    var header = document.querySelector('.cra1-site-header');
    if (!document.querySelector('.anchor-nav') && header) {
      var measure = function () { var height = header.getBoundingClientRect().height; document.documentElement.style.setProperty('--cra1-header-offset',height+'px'); document.documentElement.style.setProperty('--cra1-scroll-offset',(height+16)+'px'); };
      new ResizeObserver(measure).observe(header); measure();
    }
    var groups = document.querySelectorAll('.footer-menu-group'), media = window.matchMedia('(min-width: 768px)');
    var refresh = function () { groups.forEach(function (group) { group.open = media.matches; }); };
    media.addEventListener('change',refresh); refresh();
    document.querySelectorAll('main .spec-table table,main table.spec-table').forEach(function (table) {
      var heads = Array.from(table.querySelectorAll('thead th')).map(function (head) { return head.textContent.trim(); });
      var columns = Math.max.apply(null,Array.from(table.querySelectorAll('tr')).map(function (row) { return row.children.length; }));
      if (columns <= 3) {
        table.classList.add('spec-key-values');
        table.querySelectorAll('tbody tr').forEach(function (row) { Array.from(row.children).forEach(function (cell,index) { if (index>0) cell.dataset.label = heads[index] || ''; }); });
      } else {
        var parent = table.parentElement; parent.classList.add('spec-comparison-scroll');
        var hint = document.createElement('p'); hint.className = 'spec-scroll-hint'; hint.textContent = '左右滑动，可查看完整对比'; parent.before(hint);
      }
    });
  }

    /* ================= 启动时初始化全局 store ================= */
  document.addEventListener('api:unauthorized', function () {
    if (window.Alpine && Alpine.store('auth')) Alpine.store('auth').clear();
  });

  document.addEventListener('alpine:initialized', function () {
    Alpine.store('auth').check();
    Alpine.store('site').loadCommon();
    setupScrollEnter();
    setupPresentation();
    setupNodePopFlip();
  });

  /* Module and content entrances share one viewport observer. Pending sections
     stay pending for as long as the visitor reads the hero; they never expire
     on a page-load timer. CSS stays visible until initialization succeeds. */
  /* 服务地区节点：面板边界自适应。
     深色区块是 overflow:hidden，节点又散布在地图四角，因此面板需要三重让步，
     否则会被区块裁掉（实测：法兰克福上溢 24px、悉尼右溢 5px）：
       1. 贴上缘的节点（top < 22%）→ 面板翻到节点下方，避免超出区块顶部；
       2. 贴左右缘的节点 → 加 .node-pop-left / .node-pop-right，让面板向内对齐（不再居中）；
       3. 贴下缘的节点（top > 78%）→ 面板强制翻到上方（即便它在标签下方）。
     判定用节点的 left/top 百分比（地图按固定比例铺满，比例判定比像素测量更稳）。 */
  function setupNodePopFlip() {
    var dots = document.querySelectorAll('.node-map .node-dot');
    if (!dots.length) return;
    dots.forEach(function (dot) {
      var top = parseFloat(dot.style.top || '100');
      var left = parseFloat(dot.style.left || '50');
      /* 阈值按**实测**确定，不要凭感觉调小：
         面板高度会随内容变化（加线路标签后由 98px → 140px），阈值必须留足余量。
         实测（面板 140px、地图高约 340px）：top<32% 时仍有 5 个面板上溢最多 24px
         （上海 24px / 成都 22px / 广州 5px / 香港 3px / 迪拜 10px），故上调到 45%。 */
      if (top < 45) {
        dot.classList.add('node-pop-flip');       // 翻到下方
      } else if (top > 70) {
        dot.classList.add('node-pop-up');         // 强制翻到上方（压过「标签在下」的翻转规则）
      }
      if (left < 14) {
        dot.classList.add('node-pop-left');       // 向左对齐，避免面板左边越界
      } else if (left > 86) {
        dot.classList.add('node-pop-right');      // 向右对齐，避免面板右边越界
      }
    });
  }

  var scrollEnter = null;
  function setupScrollEnter() {
    if (scrollEnter) return;
    var html = document.documentElement;
    var scope = document.getElementById('main-content');
    if (!scope) return;
    var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var targets = new Map(), pending = new Set(), observer = null, initializing = true;
    var cards = '.feature-item,.glass-card,.bento-card,.bento-featured,.product-card,.article-card,.step,.faq-item,.promo-panel,.rail-link,.link-card,.honor-card,.partner-card,.choice-card,.solution-card,.link-tile';
    var inset = Math.min(120, Math.round(window.innerHeight * .14));
    function inViewport(element, margin) {
      var rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight - (margin || 0);
    }
    function reveal(element, instant) {
      var classes = targets.get(element);
      if (!classes || !pending.has(element)) return;
      pending.delete(element);
      if (instant) element.setAttribute('data-scroll-instant', '');
      classes.forEach(function (name) { element.classList.add(name); });
      if (observer) observer.unobserve(element);
      if (!instant && classes.indexOf('enter-in') >= 0) startCountUp(element);
    }
    function showAll() {
      pending.forEach(function (element) { reveal(element, true); });
      if (observer) observer.disconnect();
      html.setAttribute('data-cra1-scroll', 'disabled');
      scope.querySelectorAll('[data-count-to]').forEach(function (element) { element.textContent = element.getAttribute('data-count-to'); });
    }
    function register(element, className) {
      var classes = targets.get(element);
      if (classes) {
        if (classes.indexOf(className) < 0) { classes.push(className); if (!pending.has(element)) element.classList.add(className); }
        return;
      }
      targets.set(element, [className]);
      pending.add(element);
      // Nested reveal markers already travel with their parent. Never multiply
      // their fades or offsets; keyboard focus should have a stable destination.
      if (className === 'revealed' && element.parentElement.closest('[data-reveal]')) {
        element.setAttribute('data-scroll-nested', '');
        reveal(element, true); return;
      }
      var siblings = Array.from(element.parentElement.children).filter(function (child) { return child.hasAttribute('data-reveal'); });
      if (className === 'revealed') element.style.setProperty('--scroll-delay', Math.min(Math.max(0, siblings.indexOf(element)) * 60, 240) + 'ms');
      if (!observer || preference.matches || html.getAttribute('data-cra1-scroll') === 'disabled' || initializing && inViewport(element)) reveal(element, true);
      else observer.observe(element);
    }
    function scan(container) {
      container.querySelectorAll('[data-cra1-module][data-enter="grid"],[data-cra1-module][data-enter="flow"]').forEach(function (module) {
        module.querySelectorAll(cards).forEach(function (card) {
          if (card.hasAttribute('data-reveal') || card.parentElement.closest('[data-reveal]') || card.parentElement.closest(cards)) return;
          card.setAttribute('data-reveal', '');
          card.setAttribute('data-scroll-card', module.getAttribute('data-enter'));
        });
      });
      // Register async product cards too, using the existing list-update hook.
      var module = container.closest('[data-cra1-module][data-enter="grid"],[data-cra1-module][data-enter="flow"]');
      if (module) container.querySelectorAll('[data-enter-item]').forEach(function (card) {
        if (!card.parentElement.closest('[data-reveal]')) {
          card.setAttribute('data-reveal', '');
          card.setAttribute('data-scroll-card', module.getAttribute('data-enter'));
        }
      });
      container.querySelectorAll('[data-cra1-module][data-enter]').forEach(function (element) { register(element, 'enter-in'); });
      container.querySelectorAll('[data-reveal]').forEach(function (element) { register(element, 'revealed'); });
    }
    function showTarget(target) {
      if (!target || target.nodeType !== 1) return;
      pending.forEach(function (element) {
        if (element === target || element.contains(target) || target.contains(element)) reveal(element, true);
      });
    }
    function showHash() {
      var id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
      if (id) showTarget(document.getElementById(id));
    }
    try {
      if ('IntersectionObserver' in window && !preference.matches) observer = new IntersectionObserver(function (entries) {
        if (document.hidden) return;
        entries.forEach(function (entry) { if (entry.isIntersecting) reveal(entry.target, false); });
      }, { rootMargin: '0px 0px -' + inset + 'px 0px', threshold: 0 });
      scan(scope);
      initializing = false;
      html.setAttribute('data-cra1-scroll', observer ? 'ready' : 'disabled');
      showHash();
    } catch (_) { showAll(); }
    document.addEventListener('focusin', function (event) { showTarget(event.target); });
    document.addEventListener('beforematch', function (event) { showTarget(event.target); });
    window.addEventListener('hashchange', showHash);
    window.addEventListener('beforeprint', showAll);
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) pending.forEach(function (element) { if (inViewport(element)) reveal(element, true); });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pending.forEach(function (element) { if (inViewport(element, inset)) reveal(element, false); });
    });
    function reduceMotion() { if (preference.matches) showAll(); }
    if (preference.addEventListener) preference.addEventListener('change', reduceMotion);
    else preference.addListener(reduceMotion);
    scrollEnter = {
      deferList: function (container) {
        var module = container.closest('[data-cra1-module][data-enter]');
        if (!module || module.classList.contains('enter-in')) return false;
        scan(container);
        return true;
      }
    };
  }

  /* ================= 数字滚动（count 机制） =================
     服务端已把真实数值渲染进 DOM（含 + / % / 万 等后缀），这里只做"滚动显示"：
       1. 解析出数值部分与前后缀，动画期间只改数值、后缀原样保留；
       2. 结束时把服务端原值**原样写回**，因此终值必然与 SSR 一致
          （不依赖浮点reconstruction，99.9% 这类小数不会变成 99.90000000000001）；
       3. reduced-motion、无 IntersectionObserver、或值本来就不是数字时直接返回，
          保持服务端值不动（渐进增强，§7.5.8）。

     为什么用 rAF 而不是 CSS：滚动的是**文本内容**，CSS 无法插值文本。
     动画只改 textContent，不触发布局属性动画（§7.5.3 的约束针对可动画的 CSS 属性）。 */
  function startCountUp(scope) {
    if (!scope || scope.getAttribute('data-enter') !== 'count') return;
    var targets = scope.querySelectorAll('[data-count-to]');
    if (!targets.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    targets.forEach(function (el) {
      var raw = el.getAttribute('data-count-to') || '';
      // 拆出「前缀 + 数字 + 后缀」，只对数字做插值
      var m = /^([^\d]*)(\d+(?:\.\d+)?)([\s\S]*)$/.exec(raw);
      if (!m) return;                                  // 非纯数字（如"咨询"）保持不动
      var prefix = m[1];
      var numStr = m[2];
      var suffix = m[3];
      var target = parseFloat(numStr);
      if (!isFinite(target) || target === 0) return;
      var decimals = (numStr.split('.')[1] || '').length;
      var duration = 900;
      var start = null;
      var step = function (ts) {
        if (document.documentElement.getAttribute('data-cra1-scroll') !== 'ready' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          el.textContent = raw; return;
        }
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        // ease-out-quad，与 --ease-out-gentle 同形
        var eased = 1 - (1 - p) * (1 - p);
        if (p < 1) {
          el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
          requestAnimationFrame(step);
        } else {
          el.textContent = raw;                        // 终值 = 服务端原值，逐字一致
        }
      };
      requestAnimationFrame(step);
    });
  }

  /* ================= 光标跟随光斑（参考腾讯云 hero 按钮 / 阿里云 secondary-action） =================
     只做一件事：把指针位置写进 --mx / --my 两个自定义属性。
     光斑本身是 CSS 的 radial-gradient + opacity 过渡，因此动画仍在合成器上跑，
     不引入任何动效库（§7.5.3）；JS 每帧只写两个字符串，开销可忽略。

     用事件委托挂在 document 上（而非给每个 .spotlight-hover 单独绑定）：
     页面里这类按钮有几十个，且部分由 x-for 动态渲染，
     逐个绑定既要做 MutationObserver，又容易在重渲染后丢绑定。
     pointerover/pointermove 只在命中 .spotlight-hover 时才计算，代价与命中数成正比。

     reduced-motion 下不绑定：光斑是纯装饰，没有它交互依然完整。 */
  function setupSpotlightHover() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.addEventListener(
      'pointermove',
      function (e) {
        var el = e.target && e.target.closest ? e.target.closest('.spotlight-hover') : null;
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(1) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top).toFixed(1) + 'px');
      },
      { passive: true }
    );
  }

  /* ================= 列表重渲染入场 =================
     问题：分组筛选、分页翻页、搜索出结果时，Alpine 的 x-for 会**销毁并重建**节点，
     新节点一插进 DOM 就是终态（opacity:1 / transform:none），
     模块级的 data-enter 交错只在首次滚入时跑过一次，之后再不会触发——
     于是"点了分组，卡片啪地全换掉"。

     做法：数据替换后，在新节点上加一次入场动画类 + 递增 delay。
     用 animation 而非 transition：新节点没有"起始态→终态"的过渡可言，
     transition 需要先设起始态再改，会多一次重排；animation 直接播即可。

     为什么用 rAF 延后一帧：Alpine 的 x-for 在同一 tick 内完成 DOM 更新，
     此时立刻查节点可能仍是旧的；等一帧后查询能拿到最终列表。

     交错步长 40ms 并封顶 200ms：列表可能上百条（如商品列表），
     线性递增会让最后一条等 4 秒——封顶后整批在 200ms 内起跑。 */
  function animateListIn(root, selector) {
    if (!root) return;
    if (scrollEnter && scrollEnter.deferList(root)) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    requestAnimationFrame(function () {
      var items = root.querySelectorAll(selector || ':scope > *');
      Array.prototype.forEach.call(items, function (el, i) {
        el.classList.remove('list-expand-in');
        el.style.animationDelay = Math.min(i * 40, 200) + 'ms';
        void el.offsetWidth;   // 强制重排：重复加同名类不会重播动画
        el.classList.add('list-expand-in');
      });
    });
  }

  /* 暴露给 Alpine 组件与内联表达式使用 */
  window.cra1AnimateListIn = animateListIn;

  document.addEventListener('alpine:initialized', setupSpotlightHover);
})();
