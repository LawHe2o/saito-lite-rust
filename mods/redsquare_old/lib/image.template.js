module.exports = (app, mod, images) => {

  let imgs = ``;

  if (images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      imgs += `<img class="image-${i}" data-index="${i}" alt="saito dymamic image" src="${images[i]}">`
    }
  }

  return `<div class="tweet-picture">${imgs}</div>`;

}
