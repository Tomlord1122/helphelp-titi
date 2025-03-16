<script lang="ts">
  import FileUploader from '../lib/components/FileUploader.svelte';
  import GridPreview from '../lib/components/GridPreview.svelte';
  import FormatSpecs from '../lib/components/FormatSpecs.svelte';
  import { generatePDF } from '../lib/pdf-utils.js';
  
  let file = $state<File | null>(null);
  let fileContent = $state<string>('');
  let isLoading = $state<boolean>(false);
  let error = $state<string>('');
  let success = $state<string>('');
  
  function handleFileLoad(selectedFile: File, content: string) {
    file = selectedFile;
    fileContent = content;
    error = '';
  }
  
  function handleError(errorMessage: string) {
    error = errorMessage;
    file = null;
    fileContent = '';
  }
  
  async function handleGeneratePDF() {
    if (!fileContent) {
      error = 'Please upload a text file first';
      return;
    }
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      const result = await generatePDF(fileContent, file?.name || null);
      
      if ('error' in result) {
        error = result.error;
      } else {
        success = result.success;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error = 'Error generating PDF: ' + errorMessage;
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto">
    <div class="text-center">
      <h1 class="text-3xl font-extrabold text-gray-900 sm:text-4xl">
        Composition Generator
      </h1>
      <p class="mt-3 text-lg text-gray-500">
        Upload a text file and convert it to a PDF with Chinese character grids
      </p>
    </div>
    
    <div class="mt-10 bg-white shadow-md rounded-lg p-6 ">
      <div class="space-y-6">
        <!-- File Upload Component -->
        <FileUploader onFileLoad={handleFileLoad} onError={handleError} />
        
        {#if file}
          <div class="bg-gray-50 p-4 rounded-md">
            <p class="text-sm font-medium text-gray-900">File: {file.name}</p>
            {#if fileContent}
              <div class="mt-2">
                <p class="text-sm text-gray-500">Preview (first 300 characters):</p>
                <p class="mt-1 text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                  {fileContent.slice(0, 300)}
                </p>
              </div>
              
              <!-- Grid Preview Component -->
              <GridPreview text={fileContent} previewLimit={300} />
            {/if}
          </div>
        {/if}
        
        {#if error}
          <div class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">
                  {error}
                </h3>
              </div>
            </div>
          </div>
        {/if}
        
        {#if success}
          <div class="rounded-md bg-green-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-green-800">
                  {success}
                </h3>
              </div>
            </div>
          </div>
        {/if}
        
        <div class="flex justify-end">
          <button 
            type="button" 
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 hover:scale-105 transition-all duration-300"
            onclick={handleGeneratePDF}
            disabled={!fileContent || isLoading}
          >
            {#if isLoading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            {:else}
              Generate PDF
            {/if}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Format Specifications Component -->
    <div class="mt-10">
      <FormatSpecs />
    </div>
  </div>
</div>
