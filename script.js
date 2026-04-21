/* Cloudflare Worker URL — the worker securely adds the OpenAI API key server-side.
   Replace this URL with your own deployed Worker URL. */
const WORKER_URL = "https://09-prj-loreal-routine-builder.misilva2.workers.dev";

/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");

/* Track which product IDs the user has selected */
const selectedProducts = new Set();

/* Store all loaded products so the generate button can access them */
let allProducts = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

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
      updateSelectedList(products);
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

/* Update the Selected Products section */
function updateSelectedList(products) {
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML =
      "<p class='no-selection'>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = [...selectedProducts]
    .map((id) => {
      const product = products.find((p) => p.id === id);
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

      /* Also un-highlight the card in the grid if it's visible */
      const card = productsContainer.querySelector(`[data-id="${id}"]`);
      if (card) card.classList.remove("selected");

      updateSelectedList(products);
    });
  });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  allProducts = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
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
    chatWindow.innerHTML = data.choices[0].message.content;
  });

/* Chat form submission handler - sends user message to OpenAI */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  /* Get the user's message from the input field */
  const userMessage = document.getElementById("userInput").value;

  /* Send the message to the Cloudflare Worker, which forwards it to OpenAI.
     The API key is kept secret inside the Worker — never exposed in the browser. */
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
  chatWindow.innerHTML = data.choices[0].message.content;
});
