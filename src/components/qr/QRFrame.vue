<script setup>
</script>

<template>
  <div class="qr-frame relative">
    <div class="absolute inset-0 pointer-events-none">
      <svg class="w-full h-full" viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Corner ornaments - arabesque style -->
        <g class="text-emerald-800" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6">
          <!-- Top-left corner -->
          <path d="M20 20 Q30 8, 50 12 Q70 16, 80 30" />
          <path d="M20 20 Q8 30, 12 50 Q16 70, 30 80" />
          <path d="M40 20 Q45 15, 50 20 Q55 25, 60 20" />
          <path d="M20 40 Q15 45, 20 50 Q25 55, 20 60" />

          <!-- Top-right corner -->
          <path d="M380 20 Q370 8, 350 12 Q330 16, 320 30" />
          <path d="M380 20 Q392 30, 388 50 Q384 70, 370 80" />
          <path d="M360 20 Q355 15, 350 20 Q345 25, 340 20" />
          <path d="M380 40 Q385 45, 380 50 Q375 55, 380 60" />

          <!-- Bottom-left corner -->
          <path d="M20 480 Q30 492, 50 488 Q70 484, 80 470" />
          <path d="M20 480 Q8 470, 12 450 Q16 430, 30 420" />
          <path d="M40 480 Q45 485, 50 480 Q55 475, 60 480" />
          <path d="M20 460 Q15 455, 20 450 Q25 445, 20 440" />

          <!-- Bottom-right corner -->
          <path d="M380 480 Q370 492, 350 488 Q330 484, 320 470" />
          <path d="M380 480 Q392 470, 388 450 Q384 430, 370 420" />
          <path d="M360 480 Q355 485, 350 480 Q345 475, 340 480" />
          <path d="M380 460 Q385 455, 380 450 Q375 445, 380 440" />

          <!-- Diamond patterns -->
          <polygon points="100,5 110,15 100,25 90,15" />
          <polygon points="300,5 310,15 300,25 290,15" />
          <polygon points="100,495 110,485 100,475 90,485" />
          <polygon points="300,495 310,485 300,475 290,485" />
        </g>

        <!-- Gold border lines -->
        <g class="text-amber-600" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <line x1="20" y1="10" x2="380" y2="10" />
          <line x1="20" y1="490" x2="380" y2="490" />
          <line x1="10" y1="20" x2="10" y2="480" />
          <line x1="390" y1="20" x2="390" y2="480" />
        </g>

        <!-- Inner decorative line -->
        <g class="text-emerald-700" stroke="currentColor" stroke-width="0.5" opacity="0.3">
          <rect x="25" y="25" width="350" height="450" rx="4" />
          <rect x="30" y="30" width="340" height="440" rx="2" />
        </g>
      </svg>
    </div>
    <div class="relative z-10">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.qr-frame {
  position: relative;
}
</style>
