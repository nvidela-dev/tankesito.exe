import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d'

// Physics world
const gravity = { x: 0, y: -9.81, z: 0 }
const world = new RAPIER.World(gravity)

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb) // Sky blue

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 5, 10)
camera.lookAt(0, 0, 0)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(5, 10, 5)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 2048
directionalLight.shadow.mapSize.height = 2048
scene.add(directionalLight)

// Character (placeholder - chubby kid with backpack)
const character = new THREE.Group()

// Body - slightly squashed sphere for chubby look
const bodyGeometry = new THREE.SphereGeometry(0.6, 32, 32)
bodyGeometry.scale(1, 0.9, 0.85)
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 })
const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
body.castShadow = true
character.add(body)

// Backpack - red/blue for Spiderman vibes
const backpackGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.3)
const backpackMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 })
const backpack = new THREE.Mesh(backpackGeometry, backpackMaterial)
backpack.position.set(0, 0, -0.45)
backpack.castShadow = true
character.add(backpack)

// Blue stripes on backpack
const stripeGeometry = new THREE.BoxGeometry(0.08, 0.5, 0.32)
const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x0044cc })
const leftStripe = new THREE.Mesh(stripeGeometry, stripeMaterial)
leftStripe.position.set(-0.15, 0, -0.45)
character.add(leftStripe)
const rightStripe = new THREE.Mesh(stripeGeometry, stripeMaterial)
rightStripe.position.set(0.15, 0, -0.45)
character.add(rightStripe)

character.position.set(0, 3, 0) // Start higher so we can see it fall
scene.add(character)

// Character physics (dynamic ball)
const characterBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(0, 3, 0)
  .setLinearDamping(0.5)
  .setAngularDamping(0.5)
const characterBody = world.createRigidBody(characterBodyDesc)

const characterColliderDesc = RAPIER.ColliderDesc.ball(0.6)
  .setRestitution(0.7) // Bouncy!
  .setFriction(0.5)
world.createCollider(characterColliderDesc, characterBody)

// Ground
const groundGeometry = new THREE.PlaneGeometry(50, 50)
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x7cba3d,
  roughness: 0.8,
})
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Ground physics (static)
const groundBodyDesc = RAPIER.RigidBodyDesc.fixed()
const groundBody = world.createRigidBody(groundBodyDesc)

const groundColliderDesc = RAPIER.ColliderDesc.cuboid(25, 0.1, 25)
  .setTranslation(0, -0.1, 0)
world.createCollider(groundColliderDesc, groundBody)

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Step physics
  world.step()

  // Sync character position from physics
  const pos = characterBody.translation()
  const rot = characterBody.rotation()
  character.position.set(pos.x, pos.y, pos.z)
  character.quaternion.set(rot.x, rot.y, rot.z, rot.w)

  renderer.render(scene, camera)
}

animate()
