<script lang="ts">
  import { processTextForGrid } from '../../lib/text-utils.js';
  
  export let text: string;
  export let previewLimit: number = 150;
</script>

<div class="mt-4">
  <p class="text-sm font-medium text-gray-900">Preview:</p>
  <div class="mt-2 flex justify-center">
    <div class="py-2 align-middle">
      <div class="border border-gray-400 w-fit rounded-lg overflow-hidden">
        <div style="display: grid; grid-template-columns: repeat(15, 2rem); gap: 0; border-collapse: collapse; width: fit-content;">
          {#each processTextForGrid(text.slice(0, previewLimit)) as char, i}
            <div class="border border-gray-300 flex items-center justify-center text-sm font-bold" 
                 style="width: 2rem; height: 2rem; margin: -0.5px; box-sizing: border-box;">
              {char}
            </div>
          {/each}
        </div>
      </div>
      <p class="mt-2 text-xs text-gray-500 text-center">
        Showing preview of first few rows. The actual PDF will have 15 characters per row and 20 rows per page.
      </p>
    </div>
  </div>
</div> 