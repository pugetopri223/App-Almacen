import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Keyboard,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Entypo } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";

const NativeWebView =
	Platform.OS === "web" ? null : require("react-native-webview").WebView;

const DEFAULT_URL = "http://mov.cerraco.mx/";
const STORAGE_KEY = "moving-mep-home-url";

export default function App() {
	const webViewRef = useRef(null);

	const [loading, setLoading] = useState(true);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	const [homeUrl, setHomeUrl] = useState(DEFAULT_URL);
	const [tempUrl, setTempUrl] = useState(DEFAULT_URL);
	const [settingsVisible, setSettingsVisible] = useState(false);
	const [frameKey, setFrameKey] = useState(0);
	const [isOnline, setIsOnline] = useState(true);

	useEffect(() => {
		if (Platform.OS !== "web") {
			return;
		}

		const savedUrl = window.localStorage.getItem(STORAGE_KEY);
		if (savedUrl) {
			setHomeUrl(savedUrl);
			setTempUrl(savedUrl);
		}

		const syncOnlineStatus = () => setIsOnline(window.navigator.onLine);
		syncOnlineStatus();

		window.addEventListener("online", syncOnlineStatus);
		window.addEventListener("offline", syncOnlineStatus);

		return () => {
			window.removeEventListener("online", syncOnlineStatus);
			window.removeEventListener("offline", syncOnlineStatus);
		};
	}, []);

	useEffect(() => {
		if (Platform.OS === "web") {
			return undefined;
		}

		const keyboardDidShow = Keyboard.addListener("keyboardDidShow", (e) => {
			setKeyboardHeight(e.endCoordinates.height);
		});

		const keyboardDidHide = Keyboard.addListener("keyboardDidHide", () => {
			setKeyboardHeight(0);
		});

		return () => {
			keyboardDidShow.remove();
			keyboardDidHide.remove();
		};
	}, []);

	useEffect(() => {
		const hideSystemUI = async () => {
			if (Platform.OS === "android") {
				try {
					await NavigationBar.setVisibilityAsync("hidden");
					await NavigationBar.setBehaviorAsync("overlay-swipe");
					await NavigationBar.setBackgroundColorAsync("#101820");
				} catch (error) {}
			}
		};

		hideSystemUI();

		const interval = setInterval(hideSystemUI, 3000);

		return () => clearInterval(interval);
	}, []);

	const injectedJavaScriptBeforeContentLoaded = `
	(function () {
		window.__APP_ALLOW_KEYBOARD__ = false;
	})();
	true;
`;

	const hideKeyboard = useCallback(() => {
		if (Platform.OS === "web") {
			return;
		}

		Keyboard.dismiss();

		webViewRef.current?.injectJavaScript(`
			(function () {
				var active = document.activeElement;
				if (
					active &&
					(active.tagName === "INPUT" ||
					active.tagName === "TEXTAREA" ||
					active.isContentEditable)
				) {
					active.blur();
				}
			})();
			true;
		`);
	}, []);

	const requestKeyboard = useCallback(() => {
		if (Platform.OS === "web") {
			return;
		}

		webViewRef.current?.injectJavaScript(`
			(function () {
				window.__APP_ALLOW_KEYBOARD__ = true;

				var field = document.querySelector(
					'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
				);

				if (field) {
					field.focus();

					setTimeout(function () {
						field.scrollIntoView({
							behavior: "smooth",
							block: "center",
							inline: "nearest"
						});

						if (field.select) field.select();
					}, 350);
				}
			})();
			true;
		`);
	}, []);

	const reloadHome = useCallback(() => {
		setLoading(true);

		if (Platform.OS === "web") {
			setFrameKey((value) => value + 1);
			return;
		}

		webViewRef.current?.injectJavaScript(`
			window.location.href = ${JSON.stringify(homeUrl)};
			true;
		`);
	}, [homeUrl]);

	const saveSettings = useCallback(() => {
		let nextUrl = tempUrl.trim();

		if (!nextUrl) {
			Alert.alert("URL requerida", "Escribe la URL del servidor.");
			return;
		}

		if (!nextUrl.startsWith("http://") && !nextUrl.startsWith("https://")) {
			nextUrl = `https://${nextUrl}`;
		}

		setHomeUrl(nextUrl);
		setTempUrl(nextUrl);
		setSettingsVisible(false);
		setLoading(true);

		if (Platform.OS === "web") {
			window.localStorage.setItem(STORAGE_KEY, nextUrl);
			setFrameKey((value) => value + 1);
			return;
		}

		setTimeout(() => {
			webViewRef.current?.injectJavaScript(`
				window.location.href = ${JSON.stringify(nextUrl)};
				true;
			`);
		}, 100);
	}, [tempUrl]);

	const handleBlockedNavigation = useCallback(() => {
		return true;
	}, []);

	const openSettings = useCallback(() => {
		setTempUrl(homeUrl);
		setSettingsVisible(true);
	}, [homeUrl]);

	return (
		<View style={styles.safeArea}>
			<StatusBar hidden={true} />

			<View style={styles.container}>
				<View
					style={[
						styles.webViewContainer,
						{
							paddingBottom:
								Platform.OS === "web"
									? 54
									: keyboardHeight > 0
										? 0
										: 54,
						},
					]}
				>
					{Platform.OS === "web" ? (
						<WebFrame
							frameKey={frameKey}
							homeUrl={homeUrl}
							isOnline={isOnline}
							onLoadStart={() => setLoading(true)}
							onLoadEnd={() => setLoading(false)}
							onRetry={reloadHome}
						/>
					) : (
						<NativeWebView
							ref={webViewRef}
							source={{ uri: homeUrl }}
							originWhitelist={["*"]}
							style={styles.webView}
							javaScriptEnabled
							domStorageEnabled
							pullToRefreshEnabled
							setSupportMultipleWindows={false}
							injectedJavaScriptBeforeContentLoaded={
								injectedJavaScriptBeforeContentLoaded
							}
							onShouldStartLoadWithRequest={handleBlockedNavigation}
							onLoadStart={(e) => {
								console.log("LOAD START", e.nativeEvent.url);
								setLoading(true);
							}}
							onLoadEnd={() => setLoading(false)}
							onError={(e) => {
								console.log(
									new Date(Date.now()).toLocaleString(),
									"WEBVIEW ERROR",
									JSON.stringify(e.nativeEvent, null, 2),
								);
								Alert.alert(
									"Error de carga",
									"No se pudo cargar la página. Verifica tu conexión o la URL configurada.",
								);
							}}
							onHttpError={(e) => {
								console.log("HTTP ERROR", JSON.stringify(e.nativeEvent, null, 2));
							}}
							renderLoading={() => <LoadingView />}
							startInLoadingState
						/>
					)}
				</View>

				{loading ? <LoadingView compact /> : null}

				{Platform.OS === "web" || keyboardHeight === 0 ? (
					<View style={styles.toolbar}>
						<ToolbarButton onPress={openSettings} label="" icon="cog" />

						{Platform.OS !== "web" ? (
							<ToolbarButton
								onPress={requestKeyboard}
								label=""
								icon="keyboard"
							/>
						) : null}

						{Platform.OS !== "web" ? (
							<ToolbarButton
								onPress={hideKeyboard}
								label=""
								icon="chevron-thin-down"
							/>
						) : null}

						<ToolbarButton label="" icon="home" onPress={reloadHome} />
					</View>
				) : null}
			</View>

			<Modal
				visible={settingsVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setSettingsVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalBox}>
						<Text style={styles.modalTitle}>Configuracion</Text>

						<Text style={styles.modalLabel}>URL del servidor</Text>

						<TextInput
							value={tempUrl}
							onChangeText={setTempUrl}
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="url"
							style={styles.input}
							placeholder="http://mov.cerraco.mx/"
							placeholderTextColor="#8fa1b3"
						/>

						{Platform.OS === "web" ? (
							<Text style={styles.helperText}>
								La PWA funcionara offline como contenedor. El contenido del
								servidor remoto requiere conexion para actualizarse.
							</Text>
						) : null}

						<View style={styles.modalActions}>
							<Pressable
								style={[styles.modalButton, styles.cancelButton]}
								onPress={() => setSettingsVisible(false)}
							>
								<Text style={styles.modalButtonText}>Cancelar</Text>
							</Pressable>

							<Pressable
								style={[styles.modalButton, styles.saveButton]}
								onPress={saveSettings}
							>
								<Text style={styles.modalButtonText}>Guardar</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}

function WebFrame({ frameKey, homeUrl, isOnline, onLoadStart, onLoadEnd, onRetry }) {
	useEffect(() => {
		onLoadStart();
	}, [frameKey, homeUrl, onLoadStart]);

	useEffect(() => {
		if (!isOnline) {
			onLoadEnd();
			return;
		}

		const timeoutId = window.setTimeout(() => {
			window.location.assign(homeUrl);
		}, 250);

		onLoadEnd();

		return () => window.clearTimeout(timeoutId);
	}, [frameKey, homeUrl, isOnline, onLoadEnd]);

	if (!isOnline) {
		return (
			<View style={styles.offlineContainer}>
				<View style={styles.offlineCard}>
					<Text style={styles.offlineTitle}>Modo offline activo</Text>
					<Text style={styles.offlineText}>
						La app se abrio sin conexion. Cuando vuelva internet podras recargar
						el servidor configurado.
					</Text>
					<Text style={styles.offlineUrl}>{homeUrl}</Text>
					<Pressable style={styles.retryButton} onPress={onRetry}>
						<Text style={styles.retryButtonText}>Reintentar</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.offlineContainer}>
			<View style={styles.offlineCard}>
				<Text style={styles.offlineTitle}>Redirigiendo al sistema</Text>
				<Text style={styles.offlineText}>
					Para permitir el login en web, la app abre el sistema directamente en
					el dominio remoto en lugar de mantenerlo dentro del contenedor.
				</Text>
				<Text style={styles.offlineText}>
					Si no abre solo, usa alguno de estos botones.
				</Text>
				<Text style={styles.offlineUrl}>{homeUrl}</Text>
				<Pressable
					style={styles.retryButton}
					onPress={() => {
						window.location.assign(homeUrl);
					}}
				>
					<Text style={styles.retryButtonText}>Entrar ahora</Text>
				</Pressable>
				<Pressable
					style={styles.secondaryButton}
					onPress={() => {
						window.open(homeUrl, "_blank", "noopener,noreferrer");
					}}
				>
					<Text style={styles.secondaryButtonText}>Abrir en nueva pestana</Text>
				</Pressable>
			</View>
		</View>
	);
}

function LoadingView({ compact = false }) {
	return (
		<View style={compact ? styles.loadingOverlay : styles.loading}>
			<ActivityIndicator color="#ffffff" />
			{!compact ? (
				<Text style={styles.loadingText}>Cargando almacen...</Text>
			) : null}
		</View>
	);
}

function ToolbarButton({ active = false, label, onPress, icon }) {
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.toolbarButton,
				active && styles.toolbarButtonActive,
				pressed && styles.toolbarButtonPressed,
			]}
		>
			<Text
				style={[
					styles.toolbarButtonText,
					active && styles.toolbarButtonTextActive,
				]}
				numberOfLines={1}
			>
				<Entypo name={icon} size={20} color="#ffffff" /> {label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#101820",
	},
	container: {
		flex: 1,
		backgroundColor: "#101820",
	},
	webViewContainer: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
	webView: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
	toolbar: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		height: 54,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 10,
		paddingVertical: 8,
		backgroundColor: "#101820",
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#243241",
		zIndex: 999,
	},
	toolbarButton: {
		flex: 1,
		minHeight: 32,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 8,
		backgroundColor: "#243241",
		paddingHorizontal: 8,
	},
	toolbarButtonActive: {
		backgroundColor: "#f2c14e",
	},
	toolbarButtonPressed: {
		opacity: 0.76,
	},
	toolbarButtonText: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: "700",
	},
	toolbarButtonTextActive: {
		color: "#101820",
	},
	loading: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		backgroundColor: "#101820",
	},
	loadingOverlay: {
		position: "absolute",
		top: 14,
		right: 14,
		width: 34,
		height: 34,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 17,
		backgroundColor: "rgba(16, 24, 32, 0.78)",
	},
	loadingText: {
		color: "#ffffff",
		fontSize: 14,
		fontWeight: "600",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.55)",
		alignItems: "center",
		justifyContent: "center",
		padding: 20,
	},
	modalBox: {
		width: "100%",
		backgroundColor: "#101820",
		borderRadius: 14,
		padding: 18,
		borderWidth: 1,
		borderColor: "#243241",
	},
	modalTitle: {
		color: "#ffffff",
		fontSize: 18,
		fontWeight: "800",
		marginBottom: 14,
	},
	modalLabel: {
		color: "#ffffff",
		fontSize: 13,
		fontWeight: "600",
		marginBottom: 6,
	},
	input: {
		backgroundColor: "#ffffff",
		color: "#101820",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 14,
	},
	helperText: {
		color: "#b4c0cb",
		fontSize: 12,
		lineHeight: 18,
		marginTop: 12,
	},
	modalActions: {
		flexDirection: "row",
		gap: 10,
		marginTop: 16,
	},
	modalButton: {
		flex: 1,
		height: 42,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	cancelButton: {
		backgroundColor: "#243241",
	},
	saveButton: {
		backgroundColor: "#85B147",
	},
	modalButtonText: {
		color: "#ffffff",
		fontWeight: "800",
	},
	offlineContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#101820",
		padding: 24,
	},
	offlineCard: {
		width: "100%",
		maxWidth: 560,
		backgroundColor: "#18232d",
		borderRadius: 18,
		padding: 24,
		borderWidth: 1,
		borderColor: "#243241",
	},
	offlineTitle: {
		color: "#ffffff",
		fontSize: 24,
		fontWeight: "800",
		marginBottom: 10,
	},
	offlineText: {
		color: "#d3dde5",
		fontSize: 15,
		lineHeight: 22,
	},
	offlineUrl: {
		color: "#85B147",
		fontSize: 13,
		fontWeight: "700",
		marginTop: 14,
	},
	retryButton: {
		alignSelf: "flex-start",
		marginTop: 18,
		paddingHorizontal: 18,
		paddingVertical: 12,
		borderRadius: 999,
		backgroundColor: "#85B147",
	},
	retryButtonText: {
		color: "#101820",
		fontWeight: "800",
	},
	secondaryButton: {
		alignSelf: "flex-start",
		marginTop: 12,
		paddingHorizontal: 18,
		paddingVertical: 12,
		borderRadius: 999,
		backgroundColor: "#243241",
	},
	secondaryButtonText: {
		color: "#ffffff",
		fontWeight: "800",
	},
});
