document.addEventListener('DOMContentLoaded', () => {
  // Ensure this code only runs if we are on the tool page
  const platformSelection = document.getElementById('platform-selection');
  if (!platformSelection) {
      console.log("Not on the tool page, skipping tool logic.");
      return; // Exit script if not on tool page
  }

  console.log("Tool Page Loaded. Initializing tool script..."); // DEBUG

  // ---== Configuration ==---
  const GEMINI_API_KEY = "AIzaSyDbsj_KqOB6Fg9ah1zQIBoCNsS_q1C7ATQ"; // <--- YOUR KEY (INSECURE!)
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  // ---== DOM Element Selectors (Specific to tool.html) ==---
  const platformBoxes = document.querySelectorAll('.platform-box');
  const inputFormContainer = document.getElementById('input-form-container');
  const contentForm = document.getElementById('content-form');
  const formTitle = document.getElementById('form-title');
  const allPlatformFieldGroups = document.querySelectorAll('.platform-form-fields');
  const outputArea = document.getElementById('output-area');
  const geminiOutput = document.getElementById('gemini-output');
  const loadingIndicator = document.getElementById('loading-indicator');
  const toneTemplate = document.getElementById('common-tone-template');
  const imageUploadTemplate = document.getElementById('common-image-upload-template');
  const copyOutputButton = document.getElementById('copy-output-button');

  // ---== State ==---
  let selectedPlatform = null;
  let activeFormFields = null; // Reference to the currently visible form field group

  // ---== Functions ==---

  // Function to update file name display
  const updateFileName = (fileInput) => {
      const fileDisplay = fileInput.closest('.file-input-wrapper')?.querySelector('.file-name-display');
      if (fileDisplay) {
           if (fileInput.files && fileInput.files.length > 0) {
               fileDisplay.textContent = fileInput.files[0].name;
           } else {
               fileDisplay.textContent = 'No file chosen';
           }
      }
  };

  // Function to inject common form elements
  const injectCommonElements = (platformFieldsDiv) => {
      console.log(`Injecting common elements into:`, platformFieldsDiv);
      const tonePlaceholder = platformFieldsDiv.querySelector('.common-tone-group');
      const imagePlaceholder = platformFieldsDiv.querySelector('.common-image-upload-group');

      // Inject Tone Selector
      if (tonePlaceholder && toneTemplate) {
          console.log("Injecting Tone");
          tonePlaceholder.innerHTML = '';
          const toneContent = toneTemplate.content.cloneNode(true);
          const toneSelect = toneContent.querySelector('select');
          const toneLabel = toneContent.querySelector('label');
          const dynamicId = `tone-${selectedPlatform || 'default'}`;

          if (toneSelect) {
              toneSelect.id = dynamicId;
              const templateToneSelect = toneTemplate.content.querySelector('select');
               if (templateToneSelect && templateToneSelect.hasAttribute('required')) {
                  toneSelect.required = true;
               }
          }
          if (toneLabel) toneLabel.setAttribute('for', dynamicId);
          tonePlaceholder.appendChild(toneContent);
          console.log("Tone injected with ID:", dynamicId, "Required:", toneSelect?.required);
      } else {
          console.warn("Tone placeholder or template missing for", platformFieldsDiv);
      }

      // Inject Image Upload
      if (imagePlaceholder && imageUploadTemplate) {
          console.log("Injecting Image Upload");
          imagePlaceholder.innerHTML = '';
          const imageContent = imageUploadTemplate.content.cloneNode(true);
          const fileInput = imageContent.querySelector('.file-input-hidden');
          const fileLabel = imageContent.querySelector('.btn-file-upload');
          if (fileInput && fileLabel) {
              const dynamicId = `image-upload-${selectedPlatform || 'default'}`;
              fileInput.id = dynamicId;
              fileLabel.setAttribute('for', dynamicId);
              fileInput.addEventListener('change', () => updateFileName(fileInput));
              imagePlaceholder.appendChild(imageContent);
          }
      }
  };

  // Function to handle Twitter hashtag specific input visibility
  const handleTwitterHashtags = (platformFieldsDiv) => {
      const hashtagSelect = platformFieldsDiv.querySelector('#twitter-hashtags');
      const specificInput = platformFieldsDiv.querySelector('#twitter-specific-hashtags');
      if (hashtagSelect && specificInput) {
          const updateTwitterRequired = () => {
              if (hashtagSelect.value === 'Use specific hashtags:') {
                  specificInput.style.display = 'block';
                  if(platformFieldsDiv.classList.contains('active')) {
                      specificInput.required = true;
                      specificInput.disabled = false;
                  }
              } else {
                  specificInput.style.display = 'none';
                  specificInput.required = false;
                   specificInput.disabled = true;
                  specificInput.value = '';
              }
              console.log(`Twitter specific hashtags: required=${specificInput.required}, disabled=${specificInput.disabled}`);
          }
          hashtagSelect.removeEventListener('change', updateTwitterRequired);
          hashtagSelect.addEventListener('change', updateTwitterRequired);
          updateTwitterRequired(); // Initial setup based on current value
      }
  };

  // ---== API Call Function ==---
  const callGeminiAPI = async (prompt) => {
      console.log("Attempting API call...");
      loadingIndicator.style.display = 'block';
      geminiOutput.textContent = '';
      outputArea.style.display = 'block';
      if(copyOutputButton) copyOutputButton.style.display = 'none'; // Hide copy button initially

      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_GEMINI_API_KEY")) { // More robust check
         geminiOutput.textContent = "ERROR: API Key not configured in main.js.";
         loadingIndicator.style.display = 'none';
         console.error("Gemini API Key is missing or is a placeholder.");
         return;
      }

      try {
          console.log("Sending fetch request to Gemini URL...");
          const response = await fetch(GEMINI_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
              }),
          });
          console.log("Fetch response received. Status:", response.status);

          if (!response.ok) {
              let errorData = { error: { message: `HTTP error! Status: ${response.status}` } };
              try { errorData = await response.json(); console.error("API Error Response Body:", errorData); }
              catch (e) { console.error("Could not parse error response body:", e); }
              throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          console.log("API Success Response Body:", data);

          let hasContent = false;
          if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.length > 0) {
               const generatedText = data.candidates[0].content.parts[0].text;
               geminiOutput.textContent = generatedText.trim();
               console.log("Generated text extracted.");
               hasContent = true;
           } else if (data.promptFeedback) {
               console.warn("Prompt feedback received:", data.promptFeedback);
               let feedbackMessage = "Content generation may be incomplete or blocked.";
               if (data.promptFeedback.blockReason) feedbackMessage += ` Reason: ${data.promptFeedback.blockReason}.`;
               else feedbackMessage += ` Safety Ratings: ${JSON.stringify(data.promptFeedback.safetyRatings)}`;
               geminiOutput.textContent = `WARNING: ${feedbackMessage}\n\nConsider adjusting your prompt or safety settings.`;
           } else {
               if(response.ok && (!data.candidates || data.candidates.length === 0)) {
                  console.warn("API returned OK but no candidate content found.");
                  geminiOutput.textContent = "Model did not return any content. Try adjusting your prompt.";
               } else {
                  console.error("Unexpected API response structure:", data);
                  geminiOutput.textContent = 'Error: Could not extract generated content from API response.';
               }
           }
           // Show copy button only if there is content
           if(copyOutputButton && hasContent) {
               copyOutputButton.style.display = 'inline-block';
               copyOutputButton.textContent = 'Copy';
               copyOutputButton.classList.remove('copied');
               copyOutputButton.disabled = false;
           }

      } catch (error) {
          console.error('Error calling Gemini API:', error);
          geminiOutput.textContent = `Error generating content: ${error.message}`;
          if(copyOutputButton) copyOutputButton.style.display = 'none'; // Hide on error too
      } finally {
          console.log("API call finished (finally block).");
          loadingIndicator.style.display = 'none';
          if (outputArea.style.display === 'block') {
              outputArea.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
      }
  };


  // ---== Event Listeners Setup ==---

  // 1. Platform Box Clicks
  platformBoxes.forEach(box => {
      box.addEventListener('click', () => {
          selectedPlatform = box.dataset.platform;
          console.log(`Platform selected: ${selectedPlatform}`);

          if (selectedPlatform) {
              platformBoxes.forEach(b => b.classList.remove('selected'));
              box.classList.add('selected');

              allPlatformFieldGroups.forEach(group => {
                  const isActivating = group.id === `form-fields-${selectedPlatform}`;
                  group.classList.toggle('active', isActivating);

                  const inputs = group.querySelectorAll('input, select, textarea');

                  inputs.forEach(input => {
                      // Store original required state if not already done
                       if (!input.hasAttribute('data-original-required') && input.hasAttribute('required')) {
                           input.setAttribute('data-original-required', 'true');
                       } else if (!input.hasAttribute('data-original-required') && !input.hasAttribute('required')) {
                            input.setAttribute('data-original-required', 'false');
                       }

                      const originalRequired = input.dataset.originalRequired === 'true';
                      if (isActivating) {
                          input.disabled = false;
                          input.required = originalRequired;
                      } else {
                          input.disabled = true;
                          input.required = false;
                      }
                       input.style.borderColor = '';
                  });
              });

              activeFormFields = document.getElementById(`form-fields-${selectedPlatform}`);

              if (activeFormFields) {
                  console.log(`Activating form fields: #${activeFormFields.id}`);

                  injectCommonElements(activeFormFields); // Inject common elements

                  // Reset values AFTER injection
                   const formElements = activeFormFields.querySelectorAll('input, select, textarea');
                   formElements.forEach(el => {
                       if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
                       else if (el.tagName === 'SELECT') el.selectedIndex = 0; // Reset to placeholder
                       else if (el.type !== 'file') el.value = '';
                       if(el.type === 'file') { // Reset file input fully
                          el.value = null;
                          const fileDisplay = el.closest('.file-input-wrapper')?.querySelector('.file-name-display');
                          if(fileDisplay) fileDisplay.textContent = 'No file chosen';
                       }
                  });

                  if (selectedPlatform === 'Twitter') { // Handle Twitter specifics
                      handleTwitterHashtags(activeFormFields);
                  }

                  formTitle.textContent = `Generate content for ${selectedPlatform}`;
                  inputFormContainer.style.display = 'block';
                  outputArea.style.display = 'none';
                  geminiOutput.textContent = '';
                   if(copyOutputButton) copyOutputButton.style.display = 'none'; // Hide copy button
                  inputFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                  console.warn(`Form fields div not found for platform: form-fields-${selectedPlatform}`);
                  inputFormContainer.style.display = 'none';
                  activeFormFields = null;
              }
          }
      });
  });

  // 2. Form Submission
  if (contentForm) {
      console.log("Adding submit listener to form.");
      contentForm.addEventListener('submit', (event) => {
          event.preventDefault();
          console.log("Form submitted!");

          if (!contentForm.checkValidity()) {
               contentForm.reportValidity();
               console.error("Browser validation failed. Exiting submit handler.");
               alert('Please fill in all required fields.');
               return;
          }

          if (!selectedPlatform || !activeFormFields) {
              alert("Please select a platform first!");
              console.warn("Submit attempt failed: No platform or active fields.");
              return;
          }

          const formData = {};
          const activeInputs = activeFormFields.querySelectorAll('input[name]:not(:disabled), select[name]:not(:disabled), textarea[name]:not(:disabled)');
          let formIsValid = true;

           // Clear previous validation styles first
           activeInputs.forEach(input => input.style.borderColor = '');

          // JS validation (redundant with checkValidity but safe)
           activeInputs.forEach(input => {
               if (input.required && !input.value && input.type !== 'file') {
                   input.style.borderColor = 'red';
                   formIsValid = false;
               }
               if (input.type !== 'file') formData[input.name] = input.value;
          });

          if (!formIsValid) {
               alert('Please fill in all required fields (highlighted in red).');
               console.error("JS Form validation failed. Exiting submit handler.");
               return;
          }
          console.log("Form validation passed.");
          console.log("Collected FormData:", formData);

          const imageInput = activeFormFields.querySelector('.common-image-upload-group input[type="file"]:not(:disabled)');
          const imageFileSelected = imageInput && imageInput.files && imageInput.files.length > 0;
          console.log(`Image file selected: ${imageFileSelected}`);

          // --- Construct the Prompt ---
          let prompt = `Generate a social media post for the platform: ${selectedPlatform}.\n\n`;
          prompt += `**Platform Specific Details:**\n`;
          for (const key in formData) {
               if (formData[key]) {
                   const associatedElement = activeFormFields.querySelector(`[name="${key}"]`);
                   let labelText = key.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                   if (associatedElement) {
                       const labelElement = activeFormFields.querySelector(`label[for="${associatedElement.id}"]`);
                       if (labelElement) labelText = labelElement.textContent.replace(':', '');
                   }
                   prompt += `- ${labelText}: ${formData[key]}\n`;
               }
          }
          const toneValue = formData['tone'];
          prompt += `\n**Desired Tone:** ${toneValue || 'Default'}\n`;
          if (imageFileSelected) {
              const imageTopicInput = activeFormFields.querySelector(`input[name*="topic"], input[name*="description"]`);
              const imageTopic = imageTopicInput ? imageTopicInput.value : 'the user-provided image';
              prompt += `\n**Note:** Generate content suitable for posting alongside an image related to "${imageTopic}". Consider visual context.`;
          }

          console.log("--- Sending Prompt to Gemini ---"); console.log(prompt); console.log("-------------------------------");
          callGeminiAPI(prompt); // Call API
      });
  } else {
      console.error("Could not find content form element (#content-form)!");
  }

   // Store original 'required' state on load and disable/de-require inactive fields
   document.querySelectorAll('input, select, textarea').forEach(input => {
       const fieldGroup = input.closest('.platform-form-fields');
       if (fieldGroup) { // Only process inputs inside specific field groups
          if (!input.hasAttribute('data-original-required')) {
              input.setAttribute('data-original-required', input.required);
          }
          // Initially disable and remove required unless it's in an 'active' group (unlikely on load)
          if (!fieldGroup.classList.contains('active')) {
               input.disabled = true;
               input.required = false;
          }
       }
   });


   // --- ADDED: Copy Button Event Listener ---
   if (copyOutputButton) {
       copyOutputButton.style.display = 'none'; // Initially hidden
       copyOutputButton.addEventListener('click', async () => {
           const textToCopy = geminiOutput.textContent;
           if (!textToCopy || !navigator.clipboard) { // Check for clipboard support
               console.warn("No text content to copy or clipboard API not available.");
               return;
           }

           try {
               await navigator.clipboard.writeText(textToCopy);
               console.log("Text copied to clipboard!");
               // Provide user feedback
               copyOutputButton.textContent = 'Copied!';
               copyOutputButton.classList.add('copied');
               copyOutputButton.disabled = true;

               setTimeout(() => {
                   copyOutputButton.textContent = 'Copy';
                   copyOutputButton.classList.remove('copied');
                   copyOutputButton.disabled = false;
               }, 2000);

           } catch (err) {
               console.error('Failed to copy text: ', err);
               alert('Failed to copy text. Please try manually.');
           }
       });
   } else {
        console.warn("Copy button not found");
   }

}); // End DOMContentLoaded