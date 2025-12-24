export async function loadHeader() {
  try {
    const response = await fetch('./header.html');
    const headerHtml = await response.text();
    
    // Insert header at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', headerHtml);
  } catch (error) {
    console.error('Failed to load header:', error);
  }
}
