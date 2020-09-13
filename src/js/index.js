import '../scss/index.scss';
import FastClick from 'fastclick';

function loadIframe(target, src) {
  target.load((e) => {
    target.css('opacity', '1');
  })
  target.css('opacity', '0');
  target.prop('src', src);
  return target;
}

$(document).ready(() => {
  'use strict';
  const largeIframeView = $('#large-iframe-view');
  const modeButtons = $('#mode-buttons');
  const modeButtonsListItems = modeButtons.find('li');

  let apiUrl = 'http://10.0.3.1:4317';

  FastClick.attach(document.body);
  hookButtons();
  loadMainMode();
  listServiceItems();

  function hookButtons() {
    modeButtons.find('a')
      .click(function(e) {
        e.preventDefault();

        const el = $(this);
        const mode = el.parent().attr('data-mode');
        loadMode(mode);
      });
  }

  function loadMode(mode) {
    switch(mode) {
      case 'main':
        loadMainMode();
        break;
      case 'stage':
        loadStageMode();
        break;
      case 'easier':
        loadEasierMode();
        break;
    }
  }

  function makeModeButtonActive(mode) {
    modeButtonsListItems.removeClass('active');
    modeButtonsListItems.filter('[data-mode=' + mode + ']').addClass('active');
  }

  function loadMainMode() {
    makeModeButtonActive('main')
    loadIframe(largeIframeView, apiUrl + '/main');
  }

  function loadStageMode() {
    makeModeButtonActive('stage')
    loadIframe(largeIframeView, apiUrl + '/stage');
  }

  function loadEasierMode() {
    makeModeButtonActive('easier');
  }

  function listServiceItems() {
    const url = apiUrl + '/api/service/list';
    $.ajax({
      async: false,
      contentType: 'application/json',
      dataType: 'json',
      url
    }).then(
      (list) => console.log(list),
      (error) => showError(error)
    );
  }

  function showError(error) {
    alert('Erro');
  }

  function parseServiceItem(item) {

  }

  function updateServiceList(items) {
    
  }
});