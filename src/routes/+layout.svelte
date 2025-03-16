<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Help TiTi</title>
	<meta name="Help TiTi" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
