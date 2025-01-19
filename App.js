import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import MapView, { Marker, Polyline } from "react-native-maps";
import "react-native-gesture-handler";
import "react-native-reanimated";

import * as Location from "expo-location";
import debounce from "lodash.debounce";

const App = () => {
  // refs
  const bottomSheetRef = useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // callbacks
  const handleSheetChanges = useCallback((index) => {
    console.log("handleSheetChanges", index);
  }, []);

  // Função para obter localização atual
  async function getCurrentLocation() {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (granted) {
        const location = await Location.getCurrentPositionAsync();
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } else {
        Alert.alert(
          "Permissão necessária",
          "Ative a permissão de localização."
        );
      }
    } catch (error) {
      console.error("Erro ao obter localização: ", error);
    }
  }

  // Função para buscar sugestões de lugares
  const fetchSuggestions = useCallback(
    debounce(async (query) => {
      if (query.length < 3 || !currentLocation) return;

      console.log(
        "Buscando sugestões com query:",
        query,
        " e localização:",
        currentLocation
      );

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&location=${currentLocation.latitude},${currentLocation.longitude}&radius=50000&key=AIzaSyAHrSmP_6TJn801gJXnRFR437ytmVHhBXM`
        );
        const data = await response.json();
        console.log("Resposta da API:", data); // Log da resposta da API
        if (data.predictions) {
          setSuggestions(data.predictions);
        } else {
          console.log("Nenhuma sugestão encontrada.");
        }
      } catch (error) {
        console.error("Erro ao buscar sugestões: ", error);
      }
    }, 300),
    [currentLocation]
  );

  // Função para selecionar um lugar
  async function selectPlace(place) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=AIzaSyAHrSmP_6TJn801gJXnRFR437ytmVHhBXM`
      );
      const data = await response.json();

      if (data.status === "OK" && data.result && data.result.geometry) {
        const location = data.result.geometry.location;
        setSelectedPlace({
          latitude: location.lat,
          longitude: location.lng,
        });
        setDestination(place.description);
        setSuggestions([]);
      } else {
        console.log(
          "Erro ao buscar detalhes do lugar ou lugar não encontrado."
        );
      }
    } catch (error) {
      console.error("Erro ao selecionar lugar: ", error);
    }
  }

  // Função para buscar a rota
  async function fetchRoute() {
    if (!selectedPlace) {
      console.log("Nenhum destino selecionado.");
      return;
    }

    console.log("Iniciando busca de rota...");
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${selectedPlace.latitude},${selectedPlace.longitude}&key=AIzaSyAHrSmP_6TJn801gJXnRFR437ytmVHhBXM`
      );
      const data = await response.json();
      console.log("Dados da rota:", data);
      if (data.routes.length) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoordinates(points);
      } else {
        console.log("Nenhuma rota encontrada.");
      }
    } catch (error) {
      console.error("Erro ao buscar rota: ", error);
    }
  }

  // Função para decodificar a polyline
  function decodePolyline(encoded) {
    let points = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    console.log("Coordenadas decodificadas:", points);
    return points;
  }

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // renders
  return (
    <GestureHandlerRootView style={styles.gesture}>
      <View style={styles.container}>
        <View>
          <TouchableOpacity
            style={styles.button2}
            onPress={() => {
              fetchRoute();
              bottomSheetRef.current?.close(); // Minimiza o BottomSheet
            }}
          >
            <Text style={styles.buttonText}>Traçar rota</Text>
          </TouchableOpacity>
        </View>
        {currentLocation ? (
          <MapView
            style={[styles.map]}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
          >
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="Minha Localização"
            />
            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeWidth={4}
                strokeColor="blue"
              />
            )}
            {selectedPlace && (
              <Marker
                coordinate={{
                  latitude: selectedPlace.latitude,
                  longitude: selectedPlace.longitude,
                }}
                title="Destino"
              />
            )}
          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text>Obtendo localização...</Text>
          </View>
        )}
        <BottomSheet
          ref={bottomSheetRef}
          onChange={handleSheetChanges}
          snapPoints={["36%", "46%", "55%"]}
          index={3}
          enablePanDownToClose={false}
        >
          <BottomSheetView style={styles.contentContainer}>
            <TextInput
              style={styles.input}
              placeholder="Digite o destino"
              onChangeText={fetchSuggestions}
            />
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.place_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectPlace(item)}
                  style={styles.suggestion}
                >
                  <Text>{item.description}</Text>
                </TouchableOpacity>
              )}
            />
            {/* <TouchableOpacity
              onPress={() => {
                fetchRoute();
                bottomSheetRef.current?.close(); // Minimiza o BottomSheet
              }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Traçar Rota</Text>
            </TouchableOpacity> */}
          </BottomSheetView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gesture: { flex: 1 },
  container: {
    flex: 1,
  },
  button2: {
    backgroundColor: "blue",
    padding: 12,
    borderRadius: 8,
    marginTop: 0,
    zIndex: 1,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "200%",
    width: "60%",
  },
  contentContainer: {
    flex: 1,
    gap: 30,
    padding: 36,
    alignItems: "center",
  },
  map: { width: "100%", zIndex: 0, height: "100%", position: "absolute" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    width: "100%",
    padding: 18,
    marginBottom: 0,
  },
  suggestion: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc" },
  button: {
    backgroundColor: "blue",
    padding: 12,
    borderRadius: 8,
    marginTop: 0,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
  },
});

export default App;
