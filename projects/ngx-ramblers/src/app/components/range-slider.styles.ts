export const rangeSliderStyles = `
  .range-labels
    display: flex
    justify-content: space-between
    font-size: 0.85rem
    color: #6c757d
    strong
      font-size: 1.1rem
      color: var(--ramblers-colour-black)

  .range-slider-container
    padding: 0.75rem 0

  .range-slider-row
    display: flex
    align-items: center
    gap: 0.75rem

  .range-edge
    flex: 0 0 80px
    font-size: 0.9rem

  .slider-wrapper
    position: relative
    flex: 1
    height: 32px

  .slider-track
    position: absolute
    top: 50%
    left: 0
    right: 0
    height: 5px
    background-color: #dee2e6
    border-radius: 3px
    transform: translateY(-50%)
    pointer-events: none

  .slider-fill
    position: absolute
    height: 100%
    background-color: var(--ramblers-colour-sunrise)
    border-radius: 3px
    transition: all 0.1s ease

  .range-slider
    position: absolute
    width: 100%
    height: 5px
    top: 50%
    transform: translateY(-50%)
    -webkit-appearance: none
    appearance: none
    background: transparent
    outline: none

  .range-slider::-webkit-slider-thumb,
  .range-slider::-moz-range-thumb
    width: 16px
    height: 16px
    background: var(--ramblers-colour-sunrise)
    border: 2px solid #fff
    border-radius: 50%
    cursor: pointer
    box-shadow: 0 2px 4px rgba(0,0,0,0.2)

  .range-slider::-webkit-slider-thumb:hover,
  .range-slider::-moz-range-thumb:hover
    background: var(--ramblers-colour-sunrise-hover-background)

  .range-slider.range-low,
  .range-slider.range-high,
  .range-slider.range-from,
  .range-slider.range-to
    z-index: 2
`;

export const cardContainerStyles = `
  margin: 0
  border-radius: 0.75rem
  border: 1px solid rgba(0,0,0,0.075)
`;

export const titleStyles = `
  color: #4a4a4a
  font-size: 0.95rem
`;