chrome.runtime.sendMessage(
  {
    type: "checkUsername",
  },
  (response) => {
    console.log(2222, response);
    if (response) {
      window.location.href = "../index.html";
    }
  },
);
document.getElementById("extensionPage").addEventListener("click", () => {
  chrome.runtime.reload();
  setTimeout(() => {
    chrome.runtime.sendMessage(
      {
        type: "checkUsername",
      },
      (response) => {
        if (response) {
          window.location.href = "../index.html";
        }
      },
    );
  }, 2000);
});
