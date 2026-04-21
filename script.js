/* The Cloudflare Worker runs on the same domain as this site.
   POST requests to /openai are handled server-side, keeping the API key secret. */
const WORKER_URL = "/openai";

/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");

/* Track which product IDs the user has selected.
   Load any previously saved IDs from localStorage so selections survive page reloads. */
const savedIds = JSON.parse(localStorage.getItem("selectedProducts") || "[]");
const selectedProducts = new Set(savedIds);

/* Save the current selections to localStorage so they persist across reloads */
function saveSelections() {
  localStorage.setItem(
    "selectedProducts",
    JSON.stringify([...selectedProducts]),
  );
}

/* Store ALL products once so selections persist across category changes */
let allProducts = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load all product data from JSON once at startup */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Load all products immediately so cross-category selections always work.
   Then show any previously saved selections right away. */
loadProducts().then((products) => {
  allProducts = products;
  updateSelectedList();
});

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${selectedProducts.has(product.id) ? "selected" : ""}"
         data-id="${product.id}"
         data-name="${product.name}"
         data-brand="${product.brand}"
         data-image="${product.image}"
         data-description="${product.description.replace(/"/g, "&quot;")}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="desc-toggle" aria-expanded="false">Details</button>
        <p class="product-description hidden">${product.description}</p>
      </div>
    </div>
  `,
    )
    .join("");

  /* Add click listener to each card for select / unselect */
  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      /* Don't select/unselect when the Details button is clicked */
      if (e.target.classList.contains("desc-toggle")) return;

      const id = parseInt(card.dataset.id);
      if (selectedProducts.has(id)) {
        selectedProducts.delete(id);
        card.classList.remove("selected");
      } else {
        selectedProducts.add(id);
        card.classList.add("selected");
      }
      /* Save to localStorage and refresh the selected list */
      saveSelections();
      updateSelectedList();
    });

    /* Toggle description visibility when Details button is clicked */
    card.querySelector(".desc-toggle").addEventListener("click", (e) => {
      const desc = card.querySelector(".product-description");
      const btn = e.target;
      const isHidden = desc.classList.toggle("hidden");
      btn.textContent = isHidden ? "Details" : "Hide";
      btn.setAttribute("aria-expanded", !isHidden);
    });
  });
}

/* Update the Selected Products section.
   Always uses allProducts (global) so selections from any category are found. */
function updateSelectedList() {
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML =
      "<p class='no-selection'>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = [...selectedProducts]
    .map((id) => {
      /* Look up the product from the full list, not just the current category */
      const product = allProducts.find((p) => p.id === id);
      return `
      <div class="selected-tag" data-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <span>${product.name}</span>
        <button class="remove-btn" aria-label="Remove ${product.name}">&#x2715;</button>
      </div>`;
    })
    .join("");

  /* Allow removing items directly from the Selected Products list */
  selectedProductsList.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.closest(".selected-tag").dataset.id);
      selectedProducts.delete(id);
      saveSelections();

      /* Also un-highlight the card in the grid if it's visible */
      const card = productsContainer.querySelector(`[data-id="${id}"]`);
      if (card) card.classList.remove("selected");

      updateSelectedList();
    });
  });
}

/* Apply both category and search filters together and update the grid */
function applyFilters() {
  const selectedCategory = categoryFilter.value;
  const query = searchInput.value.trim().toLowerCase();

  /* Start with all products, then narrow down by category and/or search */
  let filtered = allProducts;

  if (selectedCategory) {
    filtered = filtered.filter((p) => p.category === selectedCategory);
  }

  if (query) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query),
    );
  }

  /* Show a message if no products match, otherwise display the grid */
  if (filtered.length === 0) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products match your search.</div>`;
  } else {
    displayProducts(filtered);
  }
}

/* Filter and display products when category changes.
   Uses the already-loaded allProducts so cross-category selections are kept. */
categoryFilter.addEventListener("change", applyFilters);

/* Also filter as the user types in the search box */
searchInput.addEventListener("input", applyFilters);

/* Clear All button - removes all selected products and clears localStorage */
document.getElementById("clearAll").addEventListener("click", () => {
  selectedProducts.clear();
  saveSelections();

  /* Remove the selected highlight from any visible cards */
  productsContainer
    .querySelectorAll(".product-card.selected")
    .forEach((card) => {
      card.classList.remove("selected");
    });

  updateSelectedList();
});

/* Generate Routine button - builds a prompt from selected products and asks OpenAI */
document
  .getElementById("generateRoutine")
  .addEventListener("click", async () => {
    /* Make sure the user has selected at least one product */
    if (selectedProducts.size === 0) {
      chatWindow.innerHTML = "Please select at least one product first.";
      return;
    }

    /* Build a list of selected product names and descriptions for the prompt */
    const productDetails = [...selectedProducts]
      .map((id) => {
        const product = allProducts.find((p) => p.id === id);
        return `- ${product.name} by ${product.brand}: ${product.description}`;
      })
      .join("\n");

    /* Tell the user we're working on it */
    chatWindow.innerHTML = "Building your routine…";

    /* Send the selected products to the Cloudflare Worker, which forwards to OpenAI.
       The API key is kept secret inside the Worker — never exposed in the browser. */
    try {
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: `I have selected the following L'Oréal products:\n${productDetails}\n\nPlease create a personalized skincare or beauty routine using these products. Include the order of application and any tips for best results.`,
            },
          ],
        }),
      });

      /* Display the generated routine in the chat window */
      const data = await response.json();

      /* Check for an error returned by the API */
      if (data.error) {
        chatWindow.innerHTML = `Failed to load: ${data.error.message}`;
      } else {
        chatWindow.innerHTML = data.choices[0].message.content;
      }
    } catch (error) {
      /* Show a friendly message if the request fails entirely */
      chatWindow.innerHTML =
        "Failed to load: Could not reach the AI service. Please try again.";
    }
  });

/* Chat form submission handler - sends user message to OpenAI */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  /* Get the user's message from the input field */
  const userMessage = document.getElementById("userInput").value;

  /* Send the message to the Cloudflare Worker, which forwards it to OpenAI.
     The API key is kept secret inside the Worker — never exposed in the browser. */
  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    /* Parse the response and display the assistant's reply */
    const data = await response.json();

    /* Check for an error returned by the API */
    if (data.error) {
      chatWindow.innerHTML = `Failed to load: ${data.error.message}`;
    } else {
      chatWindow.innerHTML = data.choices[0].message.content;
    }
  } catch (error) {
    /* Show a friendly message if the request fails entirely */
    chatWindow.innerHTML =
      "Failed to load: Could not reach the AI service. Please try again.";
  }
});
