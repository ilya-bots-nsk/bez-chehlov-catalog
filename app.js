// Витрина «Без чехлов». Читает только catalog.json и фото из своей папки.
(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp;
  var inTelegram = !!(tg && tg.initData);

  var catalog = { cars: [], ranges: [], seller: "" };
  var activeRange = "all";
  var openedCar = null;

  var $ = function (id) { return document.getElementById(id); };
  var grid = $("grid"), state = $("state"), filters = $("filters");
  var sheet = $("sheet"), gallery = $("gallery"), counter = $("counter");

  if (tg) {
    try {
      tg.ready();
      tg.expand();
      applyTheme();
      tg.onEvent("themeChanged", applyTheme);
      tg.BackButton.onClick(closeCar);
    } catch (e) { /* старый клиент Telegram — работаем как обычная страница */ }
  }

  function applyTheme() {
    // Telegram сам выставляет --tg-theme-*; здесь — цвет шапки и фона окна Mini App
    try {
      var p = tg.themeParams || {};
      if (p.secondary_bg_color) {
        tg.setHeaderColor(p.secondary_bg_color);
        tg.setBackgroundColor(p.secondary_bg_color);
      }
    } catch (e) {}
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function priceText(car) {
    if (car.price_text) return car.price_text;
    if (car.price) return car.price.toLocaleString("ru-RU").replace(/,/g, " ") + " ₽";
    return "Цена по запросу";
  }

  function inRange(car, r) {
    if (!r) return true;
    if (car.price == null) return false;
    return car.price >= r.from && (r.to == null || car.price <= r.to);
  }

  function renderFilters() {
    filters.textContent = "";
    var items = [{ code: "all", title: "Все" }].concat(catalog.ranges || []);
    items.forEach(function (r) {
      var b = el("button", "chip" + (r.code === activeRange ? " active" : ""), r.title);
      b.type = "button";
      b.addEventListener("click", function () {
        activeRange = r.code;
        renderFilters();
        renderGrid();
        haptic();
      });
      filters.appendChild(b);
    });
  }

  function currentRange() {
    for (var i = 0; i < (catalog.ranges || []).length; i++) {
      if (catalog.ranges[i].code === activeRange) return catalog.ranges[i];
    }
    return null;
  }

  function renderGrid() {
    grid.textContent = "";
    var cars = catalog.cars || [];
    if (!cars.length) {
      state.textContent = "Сейчас машин в продаже нет";
      filters.hidden = true;
      return;
    }
    filters.hidden = false;
    var r = currentRange();
    var shown = cars.filter(function (c) { return inRange(c, r); });
    state.textContent = shown.length ? "" : "В этой подборке сейчас машин нет";
    shown.forEach(function (car) {
      var tile = el("button", "tile");
      tile.type = "button";
      var imgBox = el("div", "tile-img");
      if (car.photos && car.photos.length) {
        var img = el("img");
        img.src = car.photos[0];
        img.alt = car.title || "";
        img.loading = "lazy";
        img.decoding = "async";
        imgBox.appendChild(img);
      } else {
        imgBox.appendChild(el("div", "noimg", "🚗"));
      }
      if (car.reserved) imgBox.appendChild(el("span", "tile-badge", "Забронирована"));
      tile.appendChild(imgBox);

      var info = el("div", "tile-info");
      info.appendChild(el("div", "tile-name", car.name || car.title || "Автомобиль"));
      var meta = [car.year, car.mileage].filter(Boolean).join(" · ");
      if (meta) info.appendChild(el("div", "tile-meta", meta));
      info.appendChild(el("div", "tile-price", priceText(car)));
      tile.appendChild(info);

      tile.addEventListener("click", function () { openCar(car); });
      grid.appendChild(tile);
    });
  }

  function openCar(car) {
    openedCar = car;
    gallery.textContent = "";
    var photos = car.photos || [];
    if (photos.length) {
      photos.forEach(function (src, i) {
        var img = el("img");
        img.src = src;
        img.alt = (car.title || "") + " — фото " + (i + 1);
        img.loading = i < 2 ? "eager" : "lazy";
        gallery.appendChild(img);
      });
    } else {
      gallery.appendChild(el("div", "noimg", "🚗"));
    }
    gallery.scrollLeft = 0;
    updateCounter();

    $("car-badge").hidden = !car.reserved;
    $("car-title").textContent = car.title || car.name || "Автомобиль";
    $("car-price").textContent = priceText(car);

    var facts = $("car-facts");
    facts.textContent = "";
    [["Год", car.year], ["Пробег", car.mileage], ["Коробка", car.gearbox], ["Статус", car.status]]
      .forEach(function (f) {
        if (!f[1]) return;
        facts.appendChild(el("dt", null, f[0]));
        facts.appendChild(el("dd", null, String(f[1])));
      });
    $("car-desc").textContent = car.description || "";

    var link = $("car-link");
    if (car.link) { link.href = car.link; link.hidden = false; } else { link.hidden = true; }
    $("contact").hidden = !catalog.seller;

    sheet.hidden = false;
    sheet.scrollTop = 0;
    document.body.classList.add("locked");
    if (tg) { try { tg.BackButton.show(); } catch (e) {} }
    haptic();
  }

  function closeCar() {
    openedCar = null;
    sheet.hidden = true;
    document.body.classList.remove("locked");
    if (tg) { try { tg.BackButton.hide(); } catch (e) {} }
  }

  function updateCounter() {
    var n = gallery.children.length;
    if (!openedCar || !(openedCar.photos || []).length || n < 2) { counter.textContent = ""; return; }
    var i = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
    counter.textContent = (Math.min(n - 1, Math.max(0, i)) + 1) + " / " + n;
  }

  function openLink(url, telegramLink) {
    if (tg && inTelegram) {
      try {
        if (telegramLink) tg.openTelegramLink(url); else tg.openLink(url);
        return;
      } catch (e) {}
    }
    window.open(url, "_blank", "noopener");
  }

  function haptic() {
    try { if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.selectionChanged(); } catch (e) {}
  }

  gallery.addEventListener("scroll", updateCounter, { passive: true });
  $("close").addEventListener("click", closeCar);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeCar(); });
  $("car-link").addEventListener("click", function (e) {
    if (!openedCar || !openedCar.link) return;
    e.preventDefault();
    openLink(openedCar.link, /^https:\/\/t\.me\//.test(openedCar.link));
  });
  $("contact").addEventListener("click", function () {
    if (!catalog.seller) return;
    openLink("https://t.me/" + encodeURIComponent(catalog.seller.replace(/^@/, "")), true);
  });

  // GitHub Pages кэширует файлы — добавляем время, чтобы всегда получать свежий каталог
  fetch("catalog.json?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      catalog = data || catalog;
      renderFilters();
      renderGrid();
    })
    .catch(function () {
      state.textContent = "Не удалось загрузить каталог. Попробуйте открыть позже.";
    });
})();
