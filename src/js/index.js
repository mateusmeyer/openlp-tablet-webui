import '../scss/index.scss';
import 'core-js/es/promise';
import 'regenerator-runtime/runtime';

import FastClick from 'fastclick';

$.ajaxSetup({cache: false, async: true});
$(document).ready(async() => await (new Main()).run());

class Main {
  constructor() {
    this.largeIframeView = $('#large-iframe-view');
    this.modeButtons = $('#mode-buttons');
    this.modeButtonsListItems = this.modeButtons.find('li');
    this.serviceList = $('#service-list');
    this.largeImageView = $('#large-image-view');

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
      lastClickedItem: null
    };

    this.apiUrl = 'http://10.0.3.1:4317';
    this.pollInterval = 300;

    FastClick.attach(document.body);
    this.hookButtons();
  }

  async run() {
    this.attachPoll();
    await this.loadMainMode();
  }

  attachPoll() {
   setInterval(() => this.poll(), this.pollInterval);
   this.poll(true);
  }

  async poll(first) {
    const polled = (await $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      url: this.apiUrl + '/api/poll'
    }))?.results;

    if(first)console.log(polled)

    const serviceChanged = polled.service != this.state.service;
    const slideChanged = polled.slide != this.state.slide;
    const itemChanged = this.state.item != polled.item;

    if (serviceChanged || itemChanged) {
      this.state.slide = polled.slide;
      this.loadMainImage();
    }

    if (itemChanged) {
      this.state.item = polled.item;

      if (polled.item != this.state.lastClickedItem) {
        this.focusServiceItem(this.serviceItemsById[polled.item], true);
      }
      this.markServiceItemActive(this.serviceItemsById[polled.item], true);
    }

    if (serviceChanged) {
      this.state.service = polled.service;
      this.loadServiceItems();
    }

  }

  hookButtons() {
    const self = this;
    this.modeButtons.find('a')
      .click(async function(e) {
        e.preventDefault();

        const el = $(this);
        const mode = el.parent().attr('data-mode');
        await self.loadMode(mode);
      });
  }

  async loadMode(mode) {
    switch(mode) {
      case 'main':
        await this.loadMainMode();
        break;
      case 'stage':
        await this.loadStageMode();
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
    this.makeModeButtonActive('main')
    this.loadIframe(this.largeIframeView, this.apiUrl + '/main');
  }

  async loadStageMode() {
    this.makeModeButtonActive('stage')
    this.loadIframe(this.largeIframeView, this.apiUrl + '/stage');
  }

  async loadEasierMode() {
    this.makeModeButtonActive('easier');
  }

  async loadSidebarItems() {
      await this.loadServiceItems();
      await this.loadControllerItems();
  }

  async loadServiceItems() {
    let items;
    
    try {
      items = await this.listServiceItems();
    } catch(e) {
      this.showError(e);
    }

    console.log(items);

    this.serviceItemsById = {};
    this.serviceList.empty();

    let focused = null;
    let i = 0;

    for (let item of items.results.items) {
      item = {...item, order: i};

      const markup = `
        <a href="#" class="list-item${item.selected?' active': ''}" data-id="${item.id}">
          ${this.makeIcon(item.plugin)}
          ${item.title}
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

      if (item.selected) {
        focused = item.id;
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
      this.serviceList.scrollTop(focusedEl.position().top - (focusedEl.height() / 2));
    }
  }
  markServiceItemActive(item) {
    const focusedEl = this.serviceItemsById[item.id]?.el;
    this.serviceList.children('.active').removeClass('active');
    focusedEl.addClass('active');
  }

  makeIcon(type) {
    switch(type) {
      case 'songs':
        return '<i class="glyphicon glyphicon-music"></i>';
      case 'bibles':
        return '<i class="glyphicon glyphicon-book"></i>';
      case 'presentations':
        return '<i class="glyphicon glyphicon-blackboard"></i>';
      default:
        return '<i class="glyphicon glyphicon-question-sign"></i>';
    }
  }

  async loadControllerItems() {

  }

  showError(error) {
    alert('Erro');
  }

  listServiceItems() {
      const url = this.apiUrl + '/api/service/list';
      return $.ajax({
          contentType: 'application/json',
          dataType: 'json',
          url
      });
  }
  
  async sendSelectServiceItem(item) {
    await $.ajax({
      url: this.apiUrl + '/api/service/set',
      dataType: 'json',
      data: {data:`{"request":{"id":${item.order}}}`}
    });
  }

  async loadMainImage() {
    const mainImage = (await $.ajax({
      contentType: 'application/json',
      dataType: 'json',
      url: this.apiUrl + '/main/image',
    }))?.results;

    if (mainImage) {
      this.largeImageView.attr('src', mainImage.slide_image);
    }
  }

  loadIframe(target, src) {
    target.load((e) => {
      target.css('opacity', '1');
    })
    target.css('opacity', '0');
    target.prop('src', src);
    return target;
  }
};