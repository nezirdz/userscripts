"use strict";
// ==UserScript==
// @name         Obsidian Omnisearch in Confluence
// @namespace    https://github.com/scambier/userscripts
// @description  Injects Obsidian notes in Confluence search results
// @author       Nezir Dzanko
// @downloadURL  https://github.com/nezirdz/userscripts/confluence_obsidian_search.user.js
// @updateURL    https://github.com/nezirdz/userscripts/confluence_obsidian_search.user.js
// @match        https://confluence.boc-group.com/*
// @match        https://www.confluence.boc-group.com/*
// @icon         https://obsidian.md/favicon.ico
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @require      https://gist.githubusercontent.com/scambier/109932d45b7592d3decf24194008be4d/raw/9c97aa67ff9c5d56be34a55ad6c18a314e5eb548/waitForKeyElements.js
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

/* globals GM_config, jQuery, $, waitForKeyElements */
const sidebarSelector = "#search-result-container";
// Names and Properties
const Strings = {
  initElementId: "quick-search-query",
  query: "",
  elementBefore: "recent-view-items-section",
  searchInputId: "search-filter-input",
  resultDivId: "OmnisearchObsidianResults",
  loadingSpanId: "OmnisearchObsidianLoading",
};

// The `new GM_config()` syntax is not recognized by the TS compiler
// @ts-ignore
const gmc = new GM_config({
  id: "ObsidianOmnisearchConfluence",
  title: "Omnisearch in Confluence - Configuration",
  fields: {
    port: {
      label: "HTTP Port",
      type: "text",
      default: "51361",
    },
    nbResults: {
      label: "Number of results to display",
      type: "int",
      default: 5,
    },
  },
  events: {
    save: () => {
      location.reload();
    },
    init: () => {},
  },
});

// Promise resolves when initialization completes
const onInit = (config) =>
  new Promise((resolve) => {
    let isInit = () =>
      setTimeout(() => (config.isInit ? resolve() : isInit()), 0);
    isInit();
  });
// Obsidian logo
const logo = `<svg height="1em" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 256 256">
        <style>
        .purple { fill: #9974F8; }
        @media (prefers-color-scheme: dark) { .purple { fill: #A88BFA; } }
        </style>
        <path class="purple" d="M94.82 149.44c6.53-1.94 17.13-4.9 29.26-5.71a102.97 102.97 0 0 1-7.64-48.84c1.63-16.51 7.54-30.38 13.25-42.1l3.47-7.14 4.48-9.18c2.35-5 4.08-9.38 4.9-13.56.81-4.07.81-7.64-.2-11.11-1.03-3.47-3.07-7.14-7.15-11.21a17.02 17.02 0 0 0-15.8 3.77l-52.81 47.5a17.12 17.12 0 0 0-5.5 10.2l-4.5 30.18a149.26 149.26 0 0 1 38.24 57.2ZM54.45 106l-1.02 3.06-27.94 62.2a17.33 17.33 0 0 0 3.27 18.96l43.94 45.16a88.7 88.7 0 0 0 8.97-88.5A139.47 139.47 0 0 0 54.45 106Z"/><path class="purple" d="m82.9 240.79 2.34.2c8.26.2 22.33 1.02 33.64 3.06 9.28 1.73 27.73 6.83 42.82 11.21 11.52 3.47 23.45-5.8 25.08-17.73 1.23-8.67 3.57-18.46 7.75-27.53a94.81 94.81 0 0 0-25.9-40.99 56.48 56.48 0 0 0-29.56-13.35 96.55 96.55 0 0 0-40.99 4.79 98.89 98.89 0 0 1-15.29 80.34h.1Z"/><path class="purple" d="M201.87 197.76a574.87 574.87 0 0 0 19.78-31.6 8.67 8.67 0 0 0-.61-9.48 185.58 185.58 0 0 1-21.82-35.9c-5.91-14.16-6.73-36.08-6.83-46.69 0-4.07-1.22-8.05-3.77-11.21l-34.16-43.33c0 1.94-.4 3.87-.81 5.81a76.42 76.42 0 0 1-5.71 15.9l-4.7 9.8-3.36 6.72a111.95 111.95 0 0 0-12.03 38.23 93.9 93.9 0 0 0 8.67 47.92 67.9 67.9 0 0 1 39.56 16.52 99.4 99.4 0 0 1 25.8 37.31Z"/></svg>
        `;

const DOMElements = {
  initElement: null,
  searchInput: null,
};

const initSearch = () => {
  waitForKeyElements(`#${Strings.searchInputId}`, () => {
    DOMElements.searchInput = document.getElementById(Strings.searchInputId);
    DOMElements.searchInput.addEventListener("keyup", () => {
      Strings.query = DOMElements.searchInput.value;
    });
    console.log("Loading Omnisearch injector");
    let init = onInit(gmc);
    init.then(() => {
      waitForKeyElements(sidebarSelector, () => {
        injectResultsContainer();
        injectTitle();
        omnisearch(Strings.query);
        $(Strings.resultDivId).prependTo(sidebarSelector);
      });
      // Make sure the results container is there
      if (!$(sidebarSelector)[0]) {
        $("#recent-view-items-section").prepend('<div id="rhs"></div>');
      }
      injectResultsContainer();
      injectTitle();
      omnisearch(Strings.query); // Make an initial call, just to avoid an improbable race condition
      console.log("Loaded Omnisearch injector");
      // Keep the results on top
      waitForKeyElements(sidebarSelector, () => {
        $(Strings.resultDivId).prependTo(sidebarSelector);
      });
    });
  });
};

const omnisearch = (searchstring) => {
  const port = gmc.get("port");
  const nbResults = gmc.get("nbResults");
  if (searchstring.length < 3) return;
  const query = `q=${encodeURIComponent(searchstring)}`;
  injectLoadingLabel();
  GM.xmlHttpRequest({
    method: "GET",
    url: `http://localhost:${port}/search?${query}`,
    onload: (res) => {
      const data = JSON.parse(res.response);
      removeLoadingLabel(data.length > 0);
      // Keep the x first results
      data.splice(nbResults);
      const resultsDiv = $(`#${Strings.resultDivId}`);
      // Delete all existing data-omnisearch-result
      $("[data-omnisearch-result]").remove();
      // Inject results
      for (const item of data) {
        const url = `obsidian://open?vault=${encodeURIComponent(
          item.vault
        )}&file=${encodeURIComponent(item.path)}`;
        const element = $(`
                <div class="MjjYud" data-omnisearch-result>
                <div class="g Ww4FFb vt6azd tF2Cxc asEBEc" style="width: 100%">
                    <div class="N54PNb BToiNc cvP2Ce">
                    <div class="kb0PBd cvP2Ce jGGQ5e">
                        <div class="yuRUbf">
                        <div>
                            <span>
                            <a href="${url}"
                                ><br />
                                <strong class="LC20lb MBeuO DKV0Md">${
                                  item.basename
                                }</strong>
                                <div class="notranslate TbwUpd NJjxre iUh30 ojE3Fb">
                                <span class="H9lube">
                                    <div class="eqA2re NjwKYd Vwoesf" aria-hidden="true">
                                    ${logo}
                                    </div>
                                </span>
                                <div>
                                    <span class="VuuXrf">Obsidian</span>
                                    <div class="byrV5b">
                                    <cite class="qLRx3b tjvcx GvPZzd cHaqb" role="text">
                                        <span class="dyjrff ob9lvb" role="text">
                                        ${item.path}
                                        </span>
                                    </cite>
                                    </div>
                                </div>
                                </div>
                            </a>
                            </span>
                        </div>
                        </div>
                    </div>
                    <div class="kb0PBd cvP2Ce">
                        <div
                        class="VwiC3b yXK7lf lyLwlc yDYNvb W8l4ac lEBKkf"
                        style="-webkit-line-clamp: 3"
                        >
                        <span> ${item.excerpt
                          .replaceAll("<br />", " ")
                          .replaceAll("<br>", " ")} </span>
                        </div>
                    </div>
                    </div>
                </div>
                </div>        
                `);
        resultsDiv.append(element);
      }
    },
    onerror: (res) => {
      console.log("Omnisearch error", res);
      const span = $("#" + Strings.loadingSpanId)[0];
      if (span) {
        span.innerHTML = `Error: Obsidian is not running or the Omnisearch server is not enabled.
                <br /><a href="Obsidian://open">Open Obsidian</a>.`;
      }
    },
  });
};

const injectTitle = () => {
  const id = "OmnisearchObsidianConfig";
  if (!$("#" + id)[0]) {
    const btn = $(`<div style="margin-bottom: 1rem">
                <span style="font-size: 18px">${logo}&nbspObsidian Omnisearch results</span>
                <span style="font-size: 12px">(<a id=${id} class="feedback-link-btn" title="Settings" href="#">settings</a>)</span>
                </div>`);
    $(`#${Strings.resultDivId}`).append(btn);
    $(document).on("click", "#" + id, () => gmc.open());
  }
};
const injectResultsContainer = () => {
  const resultsDiv = $(
    `<div id="${Strings.resultDivId}" style="margin-bottom: 2em;"></div>`
  );
  $(sidebarSelector).prepend(resultsDiv);
};

const injectLoadingLabel = () => {
  if (!$("#" + Strings.loadingSpanId)[0]) {
    const label = $(`<span id=${Strings.loadingSpanId}>Loading...</span>`);
    $(`#${Strings.resultDivId}`).append(label);
  }
};

const removeLoadingLabel = (foundResults = true) => {
  if (foundResults) {
    $("#" + Strings.loadingSpanId).remove();
  } else {
    $("#" + Strings.loadingSpanId).text("No results found");
  }
};

// get elements after contentloaded
window.addEventListener(
  "load",
  waitForKeyElements(`#${Strings.initElementId}`, () => {
    DOMElements.initElement = document.getElementById(Strings.initElementId);
    DOMElements.initElement.addEventListener("mouseup", initSearch());
  })
);
