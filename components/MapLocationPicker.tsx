import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => Promise<void>;
  initialRegion?: Region;
}

export default function MapLocationPicker({ visible, onClose, onConfirm, initialRegion }: Props) {
  const insets = useSafeAreaInsets();
  const [mapCenter, setMapCenter] = useState<Region>(
    initialRegion ?? { latitude: 30.0, longitude: 120.0, latitudeDelta: 0.01, longitudeDelta: 0.01 }
  );
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(mapCenter.latitude, mapCenter.longitude);
    setConfirming(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapCenter}
          onRegionChangeComplete={(r) => setMapCenter(r)}
          showsUserLocation={false}
          showsCompass={true}
          mapType="standard"
        />

        <View style={styles.crosshair} pointerEvents="none">
          <View style={styles.pin}>
            <Ionicons name="location" size={40} color={Colors.light.primary} />
          </View>
        </View>

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.light.primary} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>手动选点</Text>
            <Text style={styles.sub}>移动地图，将图钉对准你的位置</Text>
          </View>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.coordRow}>
            <Ionicons name="navigate-circle-outline" size={16} color="#555" />
            <Text style={styles.coordText}>
              {mapCenter.latitude.toFixed(5)},  {mapCenter.longitude.toFixed(5)}
            </Text>
          </View>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [styles.confirmBtn, { opacity: pressed || confirming ? 0.75 : 1 }]}
            disabled={confirming}
          >
            {confirming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.confirmBtnText}>确认此位置</Text>
            }
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#000" },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: { marginBottom: 40 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16, paddingBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#F0F4F0", alignItems: "center", justifyContent: "center",
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 20, paddingTop: 14, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  coordRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coordText: {
    fontSize: 12, color: "#666",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  confirmBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 16,
    paddingVertical: 14, alignItems: "center",
  },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
