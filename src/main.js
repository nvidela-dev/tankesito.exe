import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d'

// Game state
const SPAWN_POINT = { x: 0, y: 1, z: 0 }
let isDragging = false
let isLaunched = false
let dragStart = new THREE.Vector2()
let dragEnd = new THREE.Vector2()

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

character.position.set(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z)
scene.add(character)

// Character physics (dynamic ball)
const characterBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z)
  .setLinearDamping(0.5)
  .setAngularDamping(0.5)
const characterBody = world.createRigidBody(characterBodyDesc)

const characterColliderDesc = RAPIER.ColliderDesc.ball(0.6)
  .setRestitution(0.7) // Bouncy!
  .setFriction(0.5)
world.createCollider(characterColliderDesc, characterBody)

// Start with character asleep (no physics until launched)
characterBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased)

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

// Aim line
const aimLineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
const aimLineGeometry = new THREE.BufferGeometry()
const aimLine = new THREE.Line(aimLineGeometry, aimLineMaterial)
aimLine.visible = false
scene.add(aimLine)

// Helper to convert screen coords to world direction
function screenToLaunchVector(startX, startY, endX, endY) {
  const dx = startX - endX
  const dy = startY - endY

  // Scale the drag distance to launch power
  const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.05, 20)

  // Convert 2D drag to 3D launch vector (pull back = launch forward)
  return new THREE.Vector3(dx * 0.05, dy * 0.05 + power * 0.5, -power * 0.3)
}

// Update aim line visualization
function updateAimLine() {
  if (!isDragging) {
    aimLine.visible = false
    return
  }

  const launchVec = screenToLaunchVector(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y)
  const charPos = new THREE.Vector3(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z)

  // Show trajectory hint
  const points = []
  points.push(charPos)
  points.push(charPos.clone().add(launchVec.clone().multiplyScalar(0.5)))

  aimLineGeometry.setFromPoints(points)
  aimLine.visible = true
}

// Launch the character
function launch() {
  if (isLaunched) return

  const launchVec = screenToLaunchVector(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y)

  // Make character dynamic again
  characterBody.setBodyType(RAPIER.RigidBodyType.Dynamic)

  // Apply impulse
  characterBody.applyImpulse({ x: launchVec.x * 2, y: launchVec.y * 2, z: launchVec.z * 2 }, true)

  isLaunched = true
  aimLine.visible = false
}

// Reset character to spawn
function reset() {
  characterBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased)
  characterBody.setTranslation(SPAWN_POINT)
  characterBody.setRotation({ x: 0, y: 0, z: 0, w: 1 })
  characterBody.setLinvel({ x: 0, y: 0, z: 0 })
  characterBody.setAngvel({ x: 0, y: 0, z: 0 })

  character.position.set(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z)
  character.quaternion.set(0, 0, 0, 1)

  isLaunched = false
  isDragging = false
  aimLine.visible = false
}

// Mouse/touch events
renderer.domElement.addEventListener('mousedown', (e) => {
  if (isLaunched) return
  isDragging = true
  dragStart.set(e.clientX, e.clientY)
  dragEnd.set(e.clientX, e.clientY)
})

renderer.domElement.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  dragEnd.set(e.clientX, e.clientY)
  updateAimLine()
})

renderer.domElement.addEventListener('mouseup', () => {
  if (isDragging && !isLaunched) {
    launch()
  }
  isDragging = false
})

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    reset()
  }
})

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
