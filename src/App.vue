<script setup>
import { RouterView } from 'vue-router'
import AppLayout from './components/layout/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <RouterView v-slot="{ Component, route }">
      <KeepAlive>
        <component :is="Component" v-if="route.meta.keepAlive" :key="route.name" />
      </KeepAlive>
      <component :is="Component" v-if="!route.meta.keepAlive" :key="route.fullPath" />
    </RouterView>
  </AppLayout>
</template>

<style>
@import './style.css';
</style>
