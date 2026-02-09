export const DUCK_PROMPTS_EN: string[] = [
	// Understanding
	"What do you expect this function to return?",
	"What is the smallest example that breaks?",
	"Which input triggers the issue?",
	"What should happen on the happy path?",
	"Where is the first place the data could be wrong?",
	"Can you explain the goal in one sentence?",
	"What does success look like for this function?",
	"What part of this is still fuzzy to you?",

	// Assumptions
	"What assumptions does this line make about the input?",
	"What happens if this value is null or undefined?",
	"Are you assuming the array is non-empty?",
	"Is this object always shaped the way you expect?",
	"What if the API returns an empty response?",
	"Are you assuming this runs only once?",
	"What if the user does this twice?",
	"Could this be undefined on the first render?",

	// Boundaries
	"What about the empty array case?",
	"What about a single-item list?",
	"What about the maximum possible value?",
	"What about negative numbers?",
	"What about whitespace or empty strings?",
	"What about an off-by-one at the end?",
	"What if the collection is huge?",
	"What if this value is zero?",
	"What if this is NaN?",

	// Observability
	"What would you log to confirm your hypothesis?",
	"Can you print the value right before this line?",
	"What does the debugger show for this variable?",
	"What is the simplest log that proves or disproves this?",
	"Where can you add a breakpoint to see the truth?",
	"Can you add a temporary assert to validate assumptions?",
	"What does the stack trace actually say?",
	"Can you reproduce this with a tiny test?",
	
	// Naming & clarity
	"Would future-you understand this name?",
	"Is this variable name hiding a different type?",
	"Could you rename this to make the intent obvious?",
	"Is this function doing more than its name implies?",
	"Is there a clearer name for this intermediate value?",
	"Does this name describe behavior or data?",
	"Would you understand this in six months?",

	// More prompts
	"What changed right before this started failing?",
	"What is the last known good commit?",
	"What if you invert this condition?",
	"Could this be a race or timing issue?",
	"What happens on a slow network?",
	"Are you ignoring a rejected promise?",
	"Where might an exception be swallowed?",
	"Could this be an environment difference?",
	"Is this cached value stale?",
	"What does a minimal repro look like?",
];

export const DUCK_PROMPTS_ES: string[] = [
	// Comprensión
	"¿Qué esperas que devuelva esta función?",
	"¿Cuál es el ejemplo más pequeño que falla?",
	"¿Qué entrada dispara el problema?",
	"¿Qué debería pasar en el camino feliz?",
	"¿Dónde podría estar mal el dato por primera vez?",
	"¿Puedes explicar el objetivo en una sola frase?",
	"¿Cómo se ve el éxito para esta función?",
	"¿Qué parte aún te resulta confusa?",

	// Suposiciones
	"¿Qué asume esta línea sobre la entrada?",
	"¿Qué pasa si este valor es null o undefined?",
	"¿Estás asumiendo que el arreglo no está vacío?",
	"¿Este objeto siempre tiene la forma que esperas?",
	"¿Y si la API devuelve una respuesta vacía?",
	"¿Estás asumiendo que esto se ejecuta solo una vez?",
	"¿Qué pasa si el usuario hace esto dos veces?",
	"¿Podría ser undefined en el primer render?",

	// Límites
	"¿Qué pasa con el caso de arreglo vacío?",
	"¿Y con una lista de un solo elemento?",
	"¿Qué pasa con el valor máximo posible?",
	"¿Qué pasa con números negativos?",
	"¿Qué pasa con espacios en blanco o cadenas vacías?",
	"¿Hay un off-by-one al final?",
	"¿Y si la colección es enorme?",
	"¿Y si este valor es cero?",
	"¿Y si esto es NaN?",

	// Observabilidad
	"¿Qué registrarías para confirmar tu hipótesis?",
	"¿Puedes imprimir el valor justo antes de esta línea?",
	"¿Qué muestra el depurador para esta variable?",
	"¿Cuál es el log más simple que lo prueba o refuta?",
	"¿Dónde puedes poner un breakpoint para ver la verdad?",
	"¿Puedes agregar un assert temporal para validar supuestos?",
	"¿Qué dice realmente el stack trace?",
	"¿Puedes reproducir esto con un test pequeño?",

	// Nombres y claridad
	"¿Tu yo del futuro entendería este nombre?",
	"¿Este nombre de variable oculta un tipo diferente?",
	"¿Podrías renombrar esto para que la intención sea obvia?",
	"¿Esta función hace más de lo que su nombre implica?",
	"¿Hay un nombre más claro para este valor intermedio?",
	"¿Este nombre describe comportamiento o datos?",
	"¿Lo entenderías dentro de seis meses?",

	// Más preguntas
	"¿Qué cambió justo antes de que esto empezara a fallar?",
	"¿Cuál fue el último commit bueno?",
	"¿Qué pasa si inviertes esta condición?",
	"¿Podría ser un problema de carrera o de timing?",
	"¿Qué pasa con una red lenta?",
	"¿Estás ignorando una promesa rechazada?",
	"¿Dónde podría estar tragándose una excepción?",
	"¿Podría ser una diferencia de entorno?",
	"¿Este valor cacheado está viejo?",
	"¿Cómo se ve un repro mínimo?",
];

export function getDuckPrompts(language: string): readonly string[] {
	const normalized = language.toLowerCase();
	if (normalized.startsWith('es')) {
		return DUCK_PROMPTS_ES;
	}
	return DUCK_PROMPTS_EN;
}
