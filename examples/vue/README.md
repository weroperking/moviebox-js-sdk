# Vue Composable Example

useMoviebox composable for Vue 3 applications.

## Usage

1. Copy examples/vue/useMoviebox.ts into your project.
2. Install the SDK:
   `ash
   npm install moviebox-js-sdk
   `
3. Use inside setup scripts:
   `	s
   import { useMovieboxSearch } from '@/composables/useMoviebox';

   const { query, runSearch, results, loadDetails } = useMovieboxSearch();
   `
4. Bind query to inputs and call unSearch() on submit.
