import '../scss/index.scss';
import 'core-js/es/promise';
import 'regenerator-runtime/runtime';

import 'bootstrap-sass/assets/javascripts/bootstrap/modal';

import FastClick from 'fastclick';
window.jq = (fn) => fn(jQuery);

$.ajaxSetup({cache: false, async: true, timeout: 2000});
$(document).ready(async() => await (new Main()).run());

// w3schools, https://www.w3schools.com/js/js_cookies.asp
function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  var expires = `expires=${d.toUTCString()}`;
  document.cookie = `${cname}=${cvalue};${expires};path=/`;
}

// w3schools, https://www.w3schools.com/js/js_cookies.asp
function getCookie(cname) {
  var name = cname + '=';
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
}

class Main {
  constructor() {
    this.largeIframeView = $('#large-iframe-view');
    this.modeButtons = $('#mode-buttons');
    this.modeButtonsListItems = this.modeButtons.find('li');
    this.serviceList = $('#service-list');
    this.controllerList = $('#controller-list');
    this.largeImageView = $('#large-image-view');
    this.mainView = $('#main-view');
    this.sidebar = $('#sidebar');
    this.prev = $('#control-prev');
    this.next = $('#control-next');
    this.clock = $('#clock');
    this.clockHours = $('#clock-hour');
    this.clockMinutes = $('#clock-minute');
    this.statusContainer = $('#status');
    this.settingsButton = $('#settings-button');

    this.visibilityButtons = $('#visibility-buttons');

    this.serviceItemsById = {};
    this.controllerItemsById = {};

    this.state = {
      blank: false,
      display: true,
      isAuthorised: true,
      isSecure: false,
      item: null,
      service: -1,
      slide: -1,
      theme: false,
      twelve: false,
      lastClickedItem: null,
      lastClickedControllerItem: null,
      lastMinute: null,
      lastHour: null,
      clockTick: 0,
      requestError: false,
      clockSkew: 0,
      showClock: true,
      aspectRatio: '4-3',
      slideQuirkTimeout: 500,
      shownErrorOnConsole: false,
    };

    this.initSettings({
      apiUrl: location.protocol + '//' + location.host + (location.pathname ?? ''),
      skew: 0,
      showClock: true,
      aspectRatio: '4-3',
      slideQuirkTimeout: 500,
    });

    this.pollInterval = 420;

    FastClick.attach(document.body);
    this.hookButtons();
  }

  async run() {
    this.attachPoll();
    await this.loadMainMode();
  }

  attachPoll() {
   this.clockTick();
   this.poll(true);
  }

  clockTick() {
    const date = new Date();
    date.setTime(date.getTime() + (this.state.clockSkew * 1000 * 60));
    const hours = date.getHours();
    const minutes = date.getMinutes();

    if (hours != this.state.lastHour) {
      this.state.lastHour = hours;
      this.clockHours.text(hours < 10 ? '0' + hours : hours);
    }

    if (minutes != this.state.lastMinute) {
      this.state.lastMinute = minutes;
      this.clockMinutes.text(minutes < 10 ? '0' + minutes : minutes);
    }
  }

  async poll() {
    // only query time every 3 poll cycles
    if (this.state.showClock) {
      if (++this.state.clockTick == 3) {
        this.clockTick();
        this.state.clockTick = 0;
      }
    }

    try {
      const polled = (await this.doRequest({
        dataType: 'json',
        contentType: 'application/json',
        url: this.apiUrl + '/api/poll'
      }))?.results;

      const serviceChanged = polled.service != this.state.service;
      const slideChanged = polled.slide != this.state.slide;
      const itemChanged = this.state.item != polled.item;

      const cachedItem = this.serviceItemsById[polled.item];

      this.state.service = polled.service;
      this.state.slide = polled.slide;
      this.state.item = polled.item;

      if (serviceChanged || slideChanged || itemChanged) {
        this.queryMainImage(cachedItem)
      }

      if (itemChanged) {
        if (cachedItem) {
          if (polled.item != this.state.lastClickedItem) {
            this.focusServiceItem(cachedItem, true);
          }
          this.markServiceItemActive(cachedItem, true);
        } else {
          this.markServiceItemActive(null)
        }
      }

      if (serviceChanged) {
        this.state.service = polled.service;
        this.loadServiceItems();
      }

      if (polled.display) {
        this.focusVisibilityMode('desktop');
        this.state.visibilityMode = 'desktop';
      } else if (polled.blank) {
        this.focusVisibilityMode('blank');
        this.state.visibilityMode = 'blank';
      } else if (!polled.display && !polled.blank && !polled.theme) {
        this.focusVisibilityMode('show');
        this.state.visibilityMode = 'show';
      } else {
        this.focusVisibilityMode('theme');
        this.state.visibilityMode = 'theme';
      }

      if (slideChanged || serviceChanged || itemChanged) {
        this.state.slide = polled.slide;
        if (this.state.lastClickedControllerItem != polled.slide) {
          const item = this.controllerItemsById[polled.slide];
          if (item) {
            this.focusControllerItem(item);
            this.markControllerItemActive(item);
          }
          this.state.lastClickedControllerItem = polled.slide;
        }
        this.loadControllerItems();
      }
      
      this.shownErrorOnConsole = false;
    } catch(e) {
      if (!this.shownErrorOnConsole) {
        this.shownErrorOnConsole = true;
        console.error(e);
      }
      // let's continue loop interval, avoids data freeze
    }

    setTimeout(() => this.poll(), this.pollInterval);
  }

  hookButtons() {
    const self = this;
    this.modeButtons.find('a')
      .on('click', async function(e) {
        e.preventDefault();

        const el = $(this);
        const mode = el.parent().attr('data-mode');
        await self.loadMode(mode);
      });
    
    this.visibilityButtons.find('a')
      .on('click', async function(e) {
        e.preventDefault();

        const el = $(this);
        const mode = el.parent().attr('data-mode');
        self.focusVisibilityMode(mode);
        await self.sendSelectVisibilityMode(mode);
        setTimeout(() => {
          self.queryMainImage();
        }, 100);
      });
    
    this.prev.on('click', async (e) => {
      e.preventDefault();

      await this.doRequest({
        url: this.apiUrl + '/api/controller/live/previous'
      });

      // dont wait for next tick, will present main image faster
      this.loadMainImage();

      const prevItem = this.controllerItemsById[this.state.lastClickedControllerItem - 1];
      if (prevItem) {
        this.focusControllerItem(prevItem);
        this.markControllerItemActive(prevItem);
      }
    });
    
    this.next.on('click', async (e) => {
      e.preventDefault();

      await this.doRequest({
        url: this.apiUrl + '/api/controller/live/next'
      });

      // dont wait for next tick, will present main image faster
      this.loadMainImage();

      const next = this.controllerItemsById[this.state.lastClickedControllerItem + 1];
      if (next) {
        this.focusControllerItem(next);
        this.markControllerItemActive(next);
      }
    });

    this.settingsButton.on('click', (e) => {
      e.preventDefault();
      this.openSettings();
    });

    this.largeImageView.on('click', () => {
      this.loadMainImage(true);
    });

    if (this.state.showClock) {
      this.clock.addClass('visible');
    }
  }

  async loadMode(mode) {
    switch(mode) {
      case 'main':
        await this.loadMainMode();
        break;
      case 'presenter':
        await this.loadPresenterMode();
        break;
      case 'easier':
        await this.loadEasierMode();
        break;
    }
  }

  makeModeButtonActive(mode) {
    this.modeButtonsListItems.removeClass('active');
    this.modeButtonsListItems.filter('[data-mode=' + mode + ']').addClass('active');
  }

  async loadMainMode() {
    this.makeModeButtonActive('main');
    this.showAllSidebarItems();
  }

  async loadPresenterMode() {
    this.makeModeButtonActive('presenter')
    this.showSidebarControllerOnly();
  }

  async loadEasierMode() {
    this.makeModeButtonActive('easier');
  }

  showAllSidebarItems() {
    this.mainView.removeClass('col-md-7');
    this.mainView.addClass('col-md-9');
    this.sidebar.removeClass('col-md-5');
    this.sidebar.addClass('col-md-3');
    this.sidebar.removeClass('controller-only');
  }
  showSidebarControllerOnly() {
    this.mainView.removeClass('col-md-9');
    this.mainView.addClass('col-md-7');
    this.sidebar.removeClass('col-md-3');
    this.sidebar.addClass('col-md-5');
    this.sidebar.addClass('controller-only');
  }

  async loadSidebarItems() {
      await this.loadServiceItems();
      await this.loadControllerItems();
  }

  async loadServiceItems() {
    const items = await this.listServiceItems();

    this.serviceItemsById = {};
    this.serviceList.empty();

    let focused = null;
    let i = 0;

    for (let item of items.results.items) {
      item = {...item, order: i};

      let notesMarkup = item.notes ?
        `<br><small class="notes">${item.notes.replace(/\n/ig, '<br>')}</small>`
        : '';

      const markup = `
        <a href="#" class="list-item with-icon${item.selected?' active': ''}" data-id="${item.id}">
          ${this.makeIcon(item.plugin)}
          <span class="text">
            <span class="title">${item.title}</span>
            ${notesMarkup}
          </span>
        </a>`;
      const el = $(markup);

      this.serviceList.append(el);
      item.el = el;
      this.serviceItemsById[item.id] = item;

      el.click(async (e) => {
        e.preventDefault();
        this.state.lastClickedItem = item.id;
        this.markServiceItemActive(item);
        await this.sendSelectServiceItem(item);
      });

      if (item.selected && (this.state.lastClickedItem != item.id)) {
        focused = item;
      }

      ++i;
    }

    if (focused) {
      this.focusServiceItem(focused);
    }
  }

  focusServiceItem(item) {
    const focusedEl = this.serviceItemsById[item.id]?.el;
    if (focusedEl) {
      this.serviceList.scrollTop((focusedEl.position().top + this.serviceList.scrollTop()) - 48);
    }
  }
  markServiceItemActive(item) {
    const focusedEl = this.serviceItemsById[item?.id]?.el;
    this.serviceList.children('.active').removeClass('active');
    if (focusedEl) {
      focusedEl.addClass('active');
    }
  }

  makeIcon(type) {
    switch(type) {
      case 'songs':
        return '<i class="glyphicon glyphicon-music"></i>';
      case 'bibles':
        return '<i class="glyphicon glyphicon-book"></i>';
      case 'presentations':
        return '<i class="glyphicon glyphicon-blackboard"></i>';
      case 'images':
        return '<i class="glyphicon glyphicon-picture"></i>';
      default:
        return '<i class="glyphicon glyphicon-question-sign"></i>';
    }
  }

  async loadControllerItems() {
    const items = await this.listControllerItems();

    this.controllerItemsByIdItemsById = {};
    this.controllerList.empty();

    let focused = null;
    let i = 0;

    for (let item of items.results.slides) {
      item = {...item, order: i};
      
      const mainText =
        item.title
        ?? item.html;

      const withImg = !!item.img;
      const withIcon = true;
      const iconMarkup = withIcon
        ? `
          <span class="icon">
            ${item.tag}
          </span>`
        : '';

      let thumbSize = '400x400';
      switch (this.state.aspectRatio) {
        case '4-3':
          thumbSize = '400x300';
          break;
        case '5-4':
          thumbSize = '400x320';
          break;
        case '16-9':
          thumbSize = '400x225';
          break;
        case '16-10':
          thumbSize = '400x250';
          break;
      }

      const imgMarkup = withImg
        ? `<img class="thumbnail" src="${this.apiUrl + item.img.replace('/thumbnails/', `/thumbnails${thumbSize}`)}">`
        : '';

      const notesMarkup = item.slide_notes ?
        `<br><small class="notes">${item.slide_notes.replace(/\n/ig, '<br>')}</small>`
        : '';

      const markup = `
        <a href="#" class="list-item${withIcon?' with-icon':''}${item.selected?' active': ''}" data-id="${item.order}">
          ${iconMarkup}
          <span class="text">
            ${imgMarkup}
            <span class="title">${mainText}</span>
            ${notesMarkup}
          </span>
        </a>`;
      const el = $(markup);

      this.controllerList.append(el);
      item.el = el;
      this.controllerItemsById[i] = item;

      el.on('click', async (e) => {
        e.preventDefault();

        this.state.lastClickedControllerItem = item.order;
        this.markControllerItemActive(item);
        await this.sendSelectControllerItem(item);
      });

      if (item.selected) {
        focused = item;
      }

      ++i;
    }

    if (focused && (focused.order != this.state.lastClickedControllerItem)) {
      this.focusControllerItem(focused);
    }
  }

  focusControllerItem(item) {
    const focusedEl = this.controllerItemsById[item.order]?.el;
    if (focusedEl) {
      this.controllerList.scrollTop((focusedEl.position().top + this.controllerList.scrollTop()) - 64);
    }
  }
  markControllerItemActive(item) {
    const focusedEl = this.controllerItemsById[item.order]?.el;
    this.controllerList.children('.active').removeClass('active');
    if (focusedEl) {
      focusedEl.addClass('active');
    }
  }
  
  focusVisibilityMode(mode) {
    if (mode != this.state.visibilityMode) {
      this.visibilityButtons.children('.active').removeClass('active');
      this.visibilityButtons.find(`[data-mode=${mode}]`).addClass('active');
    }
  }

  async doRequest(data) {
    try {
      const result = await $.ajax(data);
      return result;
    } catch (e) {
      this.state.requestError = true;
      this.showError(e);
      throw e;
    }
  }

  showError(error) { // eslint-disable-line no-unused-vars
    this.statusContainer
      .children('.success')
      .addClass('hide')
    this.statusContainer
      .children('.error')
      .removeClass('hide');
  }

  async listServiceItems() {
      const url = this.apiUrl + '/api/service/list';
      return this.doRequest({
          contentType: 'application/json',
          dataType: 'json',
          url
      });
  }

  async listControllerItems() {
      const url = this.apiUrl + '/api/controller/live/text';
      return this.doRequest({
          contentType: 'application/json',
          dataType: 'json',
          url
      });
  }
  
  async sendSelectServiceItem(item) {
    await this.doRequest({
      url: this.apiUrl + '/api/service/set',
      dataType: 'json',
      data: {data:`{"request":{"id":${item.order}}}`}
    });
  }
  
  async sendSelectControllerItem(item) {
    await this.doRequest({
      url: this.apiUrl + '/api/controller/live/set',
      dataType: 'json',
      data: {data:`{"request":{"id":${item.order}}}`}
    });
  }
  
  async sendSelectVisibilityMode(mode) {
    await this.doRequest({
      url: this.apiUrl + '/api/display/' + mode,
    });
  }
  
  queryMainImage(cachedItem, alwaysUseQuirk) {
    cachedItem = cachedItem || this.serviceItemsById[this.state.item];

    // delaying image retrieval due to presentation software delay
    if (alwaysUseQuirk || (cachedItem && (cachedItem.plugin == 'presentations'))) {
      this.mainImageTimeoutHandle = setTimeout(() => {
        this.loadMainImage(true);
      }, this.state.slideQuirkTimeout);
    } else {
      this.loadMainImage();
    }
  }

  async loadMainImage(abortLast = false) {
    if (this.mainImageRequest) {
      if (abortLast) {
        this.mainImageRequest.abort();
        this.mainImageRequest = null;
      } else {
        return;
      }
    } 
    const xhr = this.doRequest({
      contentType: 'application/json',
      dataType: 'json',
      url: this.apiUrl + '/main/image',
    });

    this.mainImageRequest = xhr;

    const mainImage = (await xhr)?.results;

    this.mainImageRequest = null;

    if (mainImage) {
      this.largeImageView.attr('src', mainImage.slide_image);
    }
  }

  initSettings(defaultValues) {
    let settings = this.getSettings(defaultValues);

    this.apiUrl = settings.apiUrl[settings.apiUrl.length - 1] == '/'
      ? settings.apiUrl.substr(0, settings.apiUrl.length - 1)
      : settings.apiUrl;

    this.state.aspectRatio = settings.aspectRatio ?? defaultValues.aspectRatio;
    this.state.clockSkew = settings.skew ?? defaultValues.clockSkew;
    this.state.slideQuirkTimeout = settings.slideQuirkTimeout ?? defaultValues.slideQuirkTimeout;
    this.state.showClock = typeof settings.showClock == 'string' && settings.showClock.length
      ? settings.showClock == '1'
      : defaultValues.showClock;

    this.mainView.children('.main-view').addClass('is-' + settings.aspectRatio);
  }

  getSettings(defaultValues) {
    const settings = getCookie('openlp_settings');

    if (settings) {
      let object = {};
      
      for(const item of settings.split('|')) {
        const [key, value] = item.split('\\');
        object[key] = value;
      }

      return object;
    }

    return defaultValues;
  }

  setSettings(data) {
    const items = [];

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        items.push(key+'\\'+data[key]);
      }
    }
    alert(items.join('|'))

    setCookie('openlp_settings', items.join('|'), 3600);
  }

  openSettings() {
    $('#input-settings-clock').attr("checked", this.state.showClock);
    $('#input-settings-skew').val(this.state.clockSkew);
    $('#input-settings-apiaddr').val(this.apiUrl);
    $('#input-settings-ratio').val(this.state.aspectRatio);
    $('#input-settings-slidequirktimeout').val(this.state.slideQuirkTimeout);
    $('#input-settings-save').off('click');
    $('#input-settings-save').on('click', () => {
      const settings = {
        skew: $('#input-settings-skew').val(),
        showClock: $('#input-settings-clock').is(':checked') ? 1 : 0,
        apiUrl: $('#input-settings-apiaddr').val(),
        aspectRatio: $('#input-settings-ratio').val(),
        slideQuirkTimeout: $('#input-settings-slidequirktimeout').val()
      };
      this.setSettings(settings);
      location.reload();
    });
    $('#settings-modal').modal('show');
  }

  loadIframe(target, src) {
    target.load(() => {
      target.css('opacity', '1');
    })
    target.css('opacity', '0');
    target.prop('src', src);
    return target;
  }
}