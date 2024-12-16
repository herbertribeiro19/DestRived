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
import * as Location from "expo-location";
import debounce from "lodash.debounce";
import "react-native-gesture-handler";

const App = () => {
  // ref
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

  const fetchSuggestions = useCallback(
    debounce(async (query) => {
      if (query.length < 3) return;

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&location=${currentLocation.latitude},${currentLocation.longitude}&radius=50000&key=AIzaSyCz0Ilso2uEEbYmnNVUUw0CwOjGvOZinyE`
        );
        const data = await response.json();
        if (data.predictions) {
          setSuggestions(data.predictions);
        }
      } catch (error) {
        console.error("Erro ao buscar sugestões: ", error);
      }
    }, 300), // Debounce de 300ms
    [currentLocation]
  );

  async function selectPlace(place) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=AIzaSyCz0Ilso2uEEbYmnNVUUw0CwOjGvOZinyE`
      );
      const data = await response.json();
      const location = data.result.geometry.location;
      setSelectedPlace({
        latitude: location.lat,
        longitude: location.lng,
      });
      setDestination(place.description);
      setSuggestions([]);
    } catch (error) {
      console.error("Erro ao selecionar lugar: ", error);
    }
  }

  async function fetchRoute() {
    if (!selectedPlace) return;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${selectedPlace.latitude},${selectedPlace.longitude}&key=AIzaSyCz0Ilso2uEEbYmnNVUUw0CwOjGvOZinyE`
      );
      const data = await response.json();
      if (data.routes.length) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoordinates(points);
      }
    } catch (error) {
      console.error("Erro ao buscar rota: ", error);
    }
  }

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
    return points;
  }

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // renders
  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
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
          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text>Obtendo localização...</Text>
          </View>
        )}
        <BottomSheet
          ref={bottomSheetRef}
          onChange={handleSheetChanges}
          snapPoints={["30%", "40%", "50%"]}
          index={2} // Começar no topo
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
            <TouchableOpacity onPress={fetchRoute} style={styles.button}>
              <Text style={styles.buttonText}>Traçar Rota</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "grey",
  },
  contentContainer: {
    flex: 1,
    padding: 36,
    alignItems: "center",
  },
  map: { width: "100%", zIndex: 0, height: "100%", position: "absolute" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  bottomSheetContent: {
    flex: 1,
    zIndex: 1,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  suggestion: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc" },
  button: {
    backgroundColor: "blue",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
  },
});

export default App;
