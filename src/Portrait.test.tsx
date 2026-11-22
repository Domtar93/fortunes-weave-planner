import {afterEach,describe,expect,it} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import Portrait from './Portrait'
import {initialsOf,portraitSlug,portraitUrl} from './portraits'
import {growthData} from './growths'

// Character portraits (November 21, 2026): optional bundled images with an initials fallback.
afterEach(()=>cleanup())

describe('portrait file names',()=>{
 it('maps character names to predictable file names',()=>{
  expect(portraitSlug('Alexandra')).toBe('alexandra')
  expect(portraitSlug('Hong Hua')).toBe('hong-hua')
  expect(portraitSlug('Mu (with growth)')).toBe('mu')
  expect(portraitSlug('Mu')).toBe('mu')
 })
 it('gives every planning character a distinct name except the two Mu profiles',()=>{
  const slugs=growthData.characters.map(profile=>portraitSlug(profile.name))
  expect(slugs.every(slug=>/^[a-z0-9-]+$/u.test(slug))).toBe(true)
  expect(new Set(slugs).size).toBe(slugs.length-1)
 })
 it('bundles a portrait for every character except the customisable protagonist Eshmel',()=>{
  const missing=growthData.characters.filter(profile=>!portraitUrl(profile.name)).map(profile=>profile.name)
  expect(missing).toEqual(['Eshmel'])
 })
 it('builds initials without the bracketed part',()=>{
  expect(initialsOf('Alexandra')).toBe('A')
  expect(initialsOf('Hong Hua')).toBe('HH')
  expect(initialsOf('Mu (with growth)')).toBe('M')
 })
})

describe('portrait',()=>{
 it('shows initials when no picture is bundled',()=>{
  render(<Portrait name="Eshmel"/>)
  const portrait=screen.getByTestId('portrait')
  expect(portrait.textContent).toBe('E')
  expect(portrait.getAttribute('aria-hidden')).toBe('true')
  expect(portrait.querySelector('img')).toBeNull()
 })
 it('shows the picture when there is one and falls back to initials if it fails to load',()=>{
  render(<Portrait name="Alexandra" url="/portraits/alexandra.webp"/>)
  const portrait=screen.getByTestId('portrait')
  const image=portrait.querySelector('img')!
  expect(image.getAttribute('src')).toBe('/portraits/alexandra.webp')
  expect(image.getAttribute('alt')).toBe('')
  expect(portrait.className).toContain('has-portrait')
  fireEvent.error(image)
  expect(portrait.querySelector('img')).toBeNull()
  expect(portrait.textContent).toBe('A')
 })
})
